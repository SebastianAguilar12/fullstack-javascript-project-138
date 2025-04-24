import axios from 'axios';
import axiosDebug from 'axios-debug-log';
import debugFactory from 'debug';

// Crear el debug con el nombre 'page-loader'
const debug = debugFactory('page-loader');
// Configuración global del debug
axiosDebug({
    // request: (debugRequest, config) => {
    //     debugRequest(`Request with ${config.headers['content-type']} content-type to ${config.url}`);
    // },
    response: (debugResponse, response) => {
        debugResponse(`✅ ${response.config.url} [${response.status}]`);
    },
    error: (debugError, error) => {
        debugError(`❌ Error: ${error.message}`);
    }
});

// Crear una instancia de axios
const axiosInstance = axios.create();
axiosDebug.addLogger(axiosInstance, debug);

export default axiosInstance;
