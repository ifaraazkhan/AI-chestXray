// Import necessary modules and dependencies
import express from 'express';
import { selectSql, insertSql, updateSql, RecordExist } from '../utils/pg_helper.js';
import { createAuthToken, generateOTP, sendOTP, validateOTP, checkSuperUserAccount } from '../utils/helper.js';
import path, { dirname } from 'path';
import https from 'https';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import FormData from 'form-data';

import tf from '@tensorflow/tfjs-node';
import multer from 'multer';

const router = express.Router();

const currentModuleURL = import.meta.url;
const currentModulePath = dirname(fileURLToPath(currentModuleURL));

const MODEL_CONFIG_PATH = new URL('../models/xrv-all-45rot15trans15scale/config.json', currentModuleURL);
const MODEL_CONFIG = JSON.parse(await fs.promises.readFile(MODEL_CONFIG_PATH, 'utf-8'));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Load model
let model;

async function loadModel() {
  try {
    const modelPath = new URL('../models/xrv-all-45rot15trans15scale/model.json', currentModuleURL);
    model = await tf.loadGraphModel(modelPath.toString());
    console.log("Model loaded successfully!");
  } catch (error) {
    console.error("Error loading the model:", error);
  }
}
loadModel();

function prepare_image_resize_crop(tensor, size) {
  const [orig_height, orig_width, channels] = tensor.shape;

  let new_width, new_height;
  if (orig_width < orig_height) {
    new_width = size;
    new_height = Math.floor((size * orig_height) / orig_width);
  } else {
    new_height = size;
    new_width = Math.floor((size * orig_width) / orig_height);
  }

  const resized = tf.image.resizeBilinear(tensor, [new_height, new_width]);

  const hOffset = Math.floor(new_height / 2 - size / 2);
  const wOffset = Math.floor(new_width / 2 - size / 2);

  const img_cropped = resized.slice([hOffset, wOffset, 0], [size, size, channels]);

  return img_cropped.mean(2).div(255);
}

function prepareImage(imageBuffer) {
  const tensor = tf.node.decodeImage(imageBuffer, 3);

  const img_highres = prepare_image_resize_crop(tensor, Math.max(tensor.shape[0], tensor.shape[1]));
  const img_resized = prepare_image_resize_crop(tensor, MODEL_CONFIG.IMAGE_SIZE);

  const img_input = img_resized.mul(2).sub(1).mul(tf.scalar(MODEL_CONFIG.IMAGE_SCALE));

  return img_input.reshape([1, 1, MODEL_CONFIG.IMAGE_SIZE, MODEL_CONFIG.IMAGE_SIZE]);
}

function distOverClasses(values) {
  const topClassesAndProbs = [];
  for (let i = 0; i < values.length; i++) {
    let value_normalized;

    if (values[i] < MODEL_CONFIG.OP_POINT[i]) {
      value_normalized = values[i] / (MODEL_CONFIG.OP_POINT[i] * 2);
    } else {
      value_normalized = 1 - ((1 - values[i]) / ((1 - MODEL_CONFIG.OP_POINT[i]) * 2));
      if (value_normalized > 0.6 && MODEL_CONFIG.SCALE_UPPER) {
        value_normalized = Math.min(1, value_normalized * MODEL_CONFIG.SCALE_UPPER);
      }
    }
   // console.log(MODEL_CONFIG.LABELS[i] + ",pred:" + values[i] + "," + "OP_POINT:" + MODEL_CONFIG.OP_POINT[i] + "->normalized:" + value_normalized);

    topClassesAndProbs.push({
      className: MODEL_CONFIG.LABELS[i],
      probability: value_normalized
    });
  }
  return topClassesAndProbs;
}

// Cache for heatmaps
const heatmapCache = {};

function getHighestProbabilityIndex(predictionData) {
  return predictionData.indexOf(Math.max(...predictionData));
}

function generateHeatmap(prediction, imageTensor) {
    const idx = getHighestProbabilityIndex(prediction.dataSync());
  
    // Check if the gradients for the specified index are cached
    if (!heatmapCache[idx]) {
      // Compute the gradients and cache them
      tf.tidy(() => {
        const chestgrad = tf.grad(x => model.predict(x).reshape([-1]).gather(idx));
  
        const batched = imageTensor.reshape([1, 1, MODEL_CONFIG.IMAGE_SIZE, MODEL_CONFIG.IMAGE_SIZE]);
        const grad = chestgrad(batched);
  
        const layer = grad.mean(0).abs().max(0);
        heatmapCache[idx] = tf.keep(layer.clone()); // Use tf.keep to explicitly keep the tensor
        console.log("Tensor cached:", heatmapCache[idx]);
      });
    }
  
    // Get the cached gradient data
    try {
      console.log("Accessing cached tensor:", heatmapCache[idx]);
      const heatmapData = heatmapCache[idx].dataSync();
  
      // Normalize the heatmap data
      const normalizedHeatmap = normalizeHeatmap(heatmapData);
  
      return normalizedHeatmap;
    } catch (error) {
      console.error("Error when accessing heatmapCache dataSync:", error);
      throw error;
    }
  }
  

function normalizeHeatmap(heatmapData) {
  const maxIntensity = Math.max(...heatmapData);
  return heatmapData.map(value => value / maxIntensity);
}


// Function to predict TB
const makeTBPrediction = async (imageBuffer,methodType) => {
  try {
    const headers = {
      'Content-Type': 'multipart/form-data',
    };

    const formData = new FormData();
    formData.append('image', imageBuffer, 'image.png');
    formData.append('method', methodType);

    const response = await axios.post('https://rap-ria.tbportals.niaid.nih.gov/TBorNotTB', formData, {
      headers,
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};

const TBResultCalculation = async(imageBuffer)=>{
  let result = {};
  const single_Method = await makeTBPrediction(imageBuffer,'single');
  const single_2Method = await makeTBPrediction(imageBuffer,'single_2');
  const ensemble_Method = await makeTBPrediction(imageBuffer,'ensemble');

  let SM_prob = single_Method.probability_of_TB * 100;
  let SM_decision = single_Method.decision;

  let SM2_prob = single_2Method.probability_of_TB * 100;
  let SM2_decision = single_2Method.decision;

  let EM_prob = ensemble_Method.probability_of_TB * 100;
  let EM_decision = ensemble_Method.decision;

  // first check whether all method result is TB or not
  if(SM_decision == 'TB' && SM2_decision == 'TB' && EM_decision == 'TB'){
    result.TB = true;
    result.Score = 99;
  }
  // if single + emsemble decision is TB or single2 + esemble is TB then TB 
  else if ((SM2_decision == 'TB' && EM_decision == 'TB') || (SM_decision == 'TB' && EM_decision == 'TB')){
    result.TB = true;
    result.Score = 66;
  }
  else if (SM_decision == 'TB' || SM2_decision == 'TB' || EM_decision == 'TB'){
    result.TB = true;
    result.Score = 33;
  }
  else{
    result.TB = false;
    result.Score = 0;
  }

  console.log(result);

  return result;



}


router.post('/predict', upload.single('image'), async (req, res) => {
  console.log('Incoming FormData:', req.body);

  if (!req.file) {
    return res.status(400).send('No image uploaded.');
  }



  const imageBuffer = req.file.buffer;
  const tensor = prepareImage(imageBuffer);

    // Make a prediction request using the function
    let TBPredictionResult = '';
    // try {
    //   TBPredictionResult = await TBResultCalculation(imageBuffer);
    //   console.log(TBPredictionResult);   
    // } catch (error) {
      
    // }
  

  const prediction = model.predict(tensor);
  const classes = await distOverClasses(prediction.dataSync());
  //console.log(classes);

  // Generate the heatmap based on prediction and image data
 //const heatmap = generateHeatmap(prediction, tensor);

  res.json({ classes,TBPredictionResult });
});

export default router;
