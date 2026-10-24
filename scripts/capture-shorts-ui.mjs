import http from 'http';
import fs from 'fs';

// Let's test that the inspect endpoint returns the metadata for the user's short
const res = await fetch('http://localhost:3001/api/media/inspect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://www.youtube.com/shorts/iaAQs3WKT-Q' }),
});
const data = await res.json();
console.log('Inspection result for user Shorts:');
console.log('Supported:', data.supported);
console.log('Title:', data.title);
console.log('Thumbnail:', data.thumbnail);
console.log('Duration:', data.durationFormatted);
console.log('Resolutions:', data.availableResolutions);
