import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

const testUpload = async () => {
  try {
    console.log('Logging in...');
    const loginRes = await axios.post('http://127.0.0.1:5001/api/auth/login', {
      email: 'test@gmail.com',
      password: 'test'
    });
    const token = loginRes.data.token;
    console.log('Logged in. Token:', token.substring(0, 10) + '...');

    const dummyFile = path.resolve(__dirname, 'dummy.jpg');
    fs.writeFileSync(dummyFile, 'dummy image content');

    console.log('Uploading photo...');
    const form = new FormData();
    form.append('photo', fs.createReadStream(dummyFile));

    const uploadRes = await axios.post('http://127.0.0.1:5001/api/photos', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Upload success:', uploadRes.data);
  } catch (error: any) {
    console.error('Test failed:', error.response?.data || error.message);
  }
};

testUpload();
