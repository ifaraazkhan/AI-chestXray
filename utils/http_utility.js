import request from 'request';
import fs from 'fs';

export function postRequest(requestURL, reqJson, token) {
	console.log("sendHttpRequest called, params: ", "POST", requestURL, reqJson, token);
	return new Promise((resolve, reject) => {
		const options = {
			uri: requestURL,
			headers: {
				"content-type": "application/json",
				"Connection": "Keep-Alive",
				"x-api-key": token
			},
			forever: true,
			method: 'POST',
			body: reqJson
		};
		request(options, (error, response, body) => {
			if (error)
				reject(error);
			if (response.statusCode != 200) {
				reject('Invalid status code <' + response.statusCode + '>');
			}
			resolve(body);
		});
	});
}
export function getRequest(requestURL, token, apikey) {
	console.log("sendHttpRequest called, params: ", "GET", requestURL, token, apikey);
	return new Promise((resolve, reject) => {
		const options = {
			uri: requestURL,
			headers: {
				"content-type": "application/json",
				"Connection": "Keep-Alive",
				"Authorization": token,
				"apikey": apikey
			},
			forever: true,
			method: 'GET',
			body: ''
		};
		request(options, (error, response, body) => {
			if (error) {
				console.log(error);
				reject(error);
			} else {
				resolve(JSON.parse(body));
			}
		});
	});
}

