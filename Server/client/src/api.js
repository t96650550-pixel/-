// api.js
import axios from 'axios';

const API = process.env.REACT_APP_API || '';
const instance = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false
});

export default instance;
