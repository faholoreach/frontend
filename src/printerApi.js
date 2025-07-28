import axios from 'axios';

export const fetchPrinters = async () => {
  const response = await axios.get('/api/printer/list');
  return response.data;
};

export const sendPrintJob = async (printerName, items) => {
  const response = await axios.post('/api/printer/print', {
    printerName,
    items,
  });
  return response.data;
};