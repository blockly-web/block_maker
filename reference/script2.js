inputApiKey = ''
inputSystemPrompt = 'you are a helpful assistant'
inputTemperature = 0.5
inputName = 'anthropic'
async function callAnthropicClaude2(apiKey, prompt) {
  const apiUrl = 'https://api.anthropic.com/v1/complete';
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': inputApiKey
  };
  const body = JSON.stringify({
    model: 'claude-3',
    prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
    max_tokens_to_sample: 150
  });

  try {
    const response = await fetch(apiUrl, { method: 'POST', headers, body });
    const data = await response.json();
    return data.completion;
  } catch (error) {
    console.error('Error communicating with Anthropic API:', error);
    throw error;
  }
}


inputApiKey2 = ''
inputSystemPrompt2 = 'you are a helpful assistant'
inputTemperature2 = 0.5
inputName2 = 'mistral'
async function callMistral(prompt) {
  const apiKey = inputApiKey2;
  const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey
  };
  const body = JSON.stringify({
    model: "mistral-small-latest",
    temperature: inputTemperature2,
    messages: [
      {
        role: "system",
        content: inputSystemPrompt2
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

  try {
    const response = await fetch(apiUrl, { method: 'POST', headers, body });
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    return 'Error communicating with Mistral API:'+ error;
  }
}


async function callMistral3(img,type,fileType) {
  const apiKey = inputApiKey2;
  const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey
  };
  const body = JSON.stringify({
    model: "mistral-small-latest",
    temperature: inputTemperature2,
    messages: [
          {
              role: "user",
              content: [
                  {
                      type: "text",
                      text: "what is this about?",
                  },
                  {
                      type: type,
                      image_url: {
                          url: `data:${fileType};base64,${img}`,
                      },
                  },
              ],
          },
      ]
  });

  try {
    const response = await fetch(apiUrl, { method: 'POST', headers, body });
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    return 'Error communicating with Mistral API:'+ error;
  }
}


async function callAnthropicClaude(prompt) {
  const apiKey = inputApiKey;
  const apiUrl = 'https://api.anthropic.com/v1/messages';
  // const apiUrl = 'https://api.mistral.ai/v1/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    // 'Authorization': 'Bearer ' + apiKey,
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  };
  const body = JSON.stringify({
    model: "mistral-small-latest",
    temperature: inputTemperature2,
    messages: [
      {
        role: "system",
        content: inputSystemPrompt2
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

  try {
    const response = await fetch(apiUrl, { method: 'POST', headers, body });
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    return 'Error communicating with Mistral API:'+ error;
  }
}
model = 'claude-3'
outputType = 'text'

async function callAnthropicClaudeWithImage(imageBuffer) {
  const apiUrl = 'https://api.anthropic.com/v1/messages';
  const headers = {
    'Content-Type': 'multipart/form-data',
    'x-api-key': apiKey
  };

  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer]), 'image.png');
  formData.append('text', prompt);

  try {
    const response = await fetch(apiUrl, { method: 'POST', headers, body: formData });
    const data = await response.json();

    if (outputType === 'text') {
      return data.completion;
    } else {
      // Handle other output types as needed
      throw new Error('Unsupported output type');
    }
  } catch (error) {
    console.error('Error communicating with Anthropic API:', error);
    throw error;
  }
}


async function describeImage(base64Image, prompt) {

  const chatResponse = await client.chat.complete({
      model: "mistral-small-latest",
      messages: [
          {
              role: "user",
              content: [
                  {
                      type: "text",
                      text: prompt,
                  },
                  {
                      type: "image_url",
                      image_url: {
                          url: `data:image/jpeg;base64,${base64Image}`,
                      },
                  },
              ],
          },
      ],
  });
  return chatResponse.choices[0].message.content;
}
