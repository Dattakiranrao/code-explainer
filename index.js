const fs = require('fs');
const axios = require('axios');
const Limiter = require('limiter').RateLimiter;

const limiter = new Limiter({ tokensPerInterval: 1, interval: 'second' });
const retryDelay = 1000; // 1 second
const maxRetries = 3;

const config = require('./config.json'); // Make sure your config file is set up correctly

const getCodeFromFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file: ${filePath}`);
    process.exit(1);
  }
};

const explainCode = async (code) => {
  try {
    const response = await axios.post(
      `${config.endpoint}/v1/engines/davinci/completions`,
      {
        prompt: `Explain the following code:\n\n${code}`,
        max_tokens: 100,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
      }
    );
    return response.data.choices[0].text.trim();
  } catch (error) {
    throw error;
  }
};

const explainCodeWithRetry = async (code, retries = maxRetries) => {
  try {
    await limiter.removeTokens(1);
    return await explainCode(code);
  } catch (error) {
    if (error.response && error.response.status === 429 && retries > 0) {
      console.log(`Rate limit exceeded. Retrying in ${retryDelay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return explainCodeWithRetry(code, retries - 1);
    } else {
      throw error;
    }
  }
};

const main = async () => {
  const argv = require('yargs').argv;
  const filePath = argv._[0];

  if (!filePath) {
    console.error('Please provide a file path as an argument.');
    process.exit(1);
  }

  const code = getCodeFromFile(filePath);

  try {
    const explanation = await explainCodeWithRetry(code);
    console.log('Code Explanation:\n', explanation);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

main();

