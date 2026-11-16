import { createApp } from './app';
import { env } from './config/env';

const { API_PORT } = env();
createApp().listen(API_PORT, () => {
  console.log(`API listening on :${API_PORT}`);
});
