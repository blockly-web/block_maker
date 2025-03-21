inputApiKey = ''
inputApiKey2 = ''
inputApiKey3 = ''

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
    const contentType = response.headers.get('Content-Type');
    let data;
    if (contentType && contentType.includes('application/json')) {
        data = await response.json();
    } else {
        data = await response.text(); // Handle non-JSON responses
    }
    return data.completion;
  } catch (error) {
    console.error('Error communicating with Anthropic API:', error);
    throw error;
  }
}

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
    return 'Error communicating with Mistral API:' + error;
  }
}


async function callMistral3(img, type, fileType) {
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
    return 'Error communicating with Mistral API:' + error;
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
    return 'Error communicating with Mistral API:' + error;
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


// https://api.openai.com/v1/chat/completions
// -H "Content-Type: application/json" \
//     -H "Authorization: Bearer $OPENAI_API_KEY" \
//     -d '{
//         "model": "gpt-4o",
//         "messages": [{
//             "role": "user",
//             "content": "Write a one-sentence bedtime story about a unicorn."
//         }]
//     }'
async function callOpenAI(prompt) {
  const apiKey = inputApiKey3;
  const apiUrl = 'https://api.openai.com/v1/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey
  };
  const body = JSON.stringify({
    model: "gpt-4o",
    messages: [
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
    return 'Error communicating with OpenAI API:' + error;
  }
}


const transcribeAudio = async (base64Audio) => {
  // Convert the base64 string to a Uint8Array buffer
  const buffer = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));

  // Create a Blob from the buffer
  const blob = new Blob([buffer], { type: 'audio/webm' });

  // Prepare the FormData for the request (OpenAI requires the audio to be sent as multipart/form-data)
  const formData = new FormData();
  formData.append('file', blob, 'audio.webm');
  formData.append('model', 'whisper-1');

  // Send the request to OpenAI API
  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${inputApiKey3}`,
      },
      body: formData,
    });

    // Parse the response JSON
    const data = await response.json();

    if (response.ok) {
      console.log('Transcription: ', data.text);
      return data.text;  // Return the transcription text
    } else {
      console.error('Error transcribing audio:', data);
      return null;
    }
  } catch (error) {
    console.error('Error during transcription:', error);
    return null;
  }
};


// async function callOpenAIwthPromptAndImage(prompt, imageBuffer) {
//   const
//     apiUrl = 'https://api.openai.com/v1/chat/completions',
//     headers = {
//       'Content-Type': 'multipart/form-data',
//       'Autho



// curl https://api.openai.com/v1/images/generations \
//   -H "Content-Type: application/json" \
//   -H "Authorization: Bearer $OPENAI_API_KEY" \
//   -d '{
//     "model": "dall-e-3",
//     "prompt": "A cute baby sea otter",
//     "n": 1,
//     "size": "1024x1024"
//   }'

const generateImage = async (prompt) => {
  const apiUrl = 'https://api.openai.com/v1/images/generations';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + inputApiKey3
  };
  const body = JSON.stringify({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024"
  }); //  "A cute baby sea otter"

  try {
    const response = await fetch(apiUrl, { method: 'POST', headers, body });
    const data = await response.json();
    return data.data[0].url;
  }
  catch (error) {
    return 'Error communicating with OpenAI API:' + error;
  }
}


// curl https://api.openai.com/v1/audio/speech \
//   -H "Authorization: Bearer $OPENAI_API_KEY" \
//   -H "Content-Type: application/json" \
//   -d '{
//     "model": "tts-1",
//     "input": "The quick brown fox jumped over the lazy dog.",
//     "voice": "alloy"
//   }' \

const generateSpeech = async (prompt) => {
  const apiUrl = 'https://api.openai.com/v1/audio/speech';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + inputApiKey3
  };

  const body = JSON.stringify({
    model: "tts-1",
    input: prompt,
    voice: "alloy"
  });

  try {
    const response = await fetch(apiUrl, { method: 'POST', headers, body });
    const blob = await response.blob();
    // Optionally, create an object URL for the audio
    return URL.createObjectURL(blob);
    
  }
  catch (error) {
    return 'Error communicating with OpenAI API:' + error;
  }
}