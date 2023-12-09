import express from 'express';
import cookieparser from 'cookie-parser';
import { frameguard } from 'helmet';
import cors from 'cors';
import auth from '../routes/auth.js';
import userdetails from '../routes/userdetails.js';
import payments from '../routes/payments.js';
import aiModel from '../routes/aiModel.js';

import {schemaValidation, validateToken } from '../utils/middlewares.js';


const corsOptions = {
    origin: `${process.env.CORS_DOMAIN}`
};

const ROUTES = (server) => {
    server.use(express.json({ limit: '50mb' }))
    server.use(express.urlencoded({ extended: true }));
    server.use(cors(corsOptions));
    server.use(cookieparser());
    server.use(frameguard({ action: 'DENY' }));

   // Error handling middleware
    server.use((err, req, res, next) => {
    console.error(err); // Log the error for debugging purposes
    // Send an error response to the client
    res.status(500).json({ error: 'Internal Server Error' });
  });

    
    server.use('/auth', [schemaValidation], auth);
    server.use('/user', [schemaValidation,validateToken], userdetails);
    server.use('/payment', [schemaValidation,validateToken], payments);
    server.use('/ai', aiModel);
};

export default ROUTES;