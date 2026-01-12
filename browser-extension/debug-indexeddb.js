// Debug script to check IndexedDB voiceovers
// Run this in the browser console to see what's stored

async function listAllVoiceovers() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WebReplayDB', 3);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      console.log('Database version:', db.version);
      console.log('Available stores:', Array.from(db.objectStoreNames));

      if (!db.objectStoreNames.contains('voiceovers')) {
        console.error('No voiceovers store found!');
        db.close();
        resolve([]);
        return;
      }

      const transaction = db.transaction(['voiceovers'], 'readonly');
      const store = transaction.objectStore('voiceovers');
      const getAllRequest = store.getAllKeys();

      getAllRequest.onsuccess = () => {
        const keys = getAllRequest.result;
        console.log('Found', keys.length, 'voiceovers:');
        keys.forEach(key => console.log('  -', key));

        // Get details for each
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const values = getAll.result;
          console.log('\nVoiceover details:');
          values.forEach((blob, index) => {
            console.log(`  ${keys[index]}:`, blob.size, 'bytes, type:', blob.type);
          });
          db.close();
          resolve(keys);
        };
      };

      getAllRequest.onerror = () => {
        console.error('Error getting keys:', getAllRequest.error);
        db.close();
        reject(getAllRequest.error);
      };
    };
  });
}

// Run it
console.log('Checking IndexedDB for voiceovers...');
listAllVoiceovers().then(keys => {
  if (keys.length === 0) {
    console.log('❌ No voiceovers found in IndexedDB');
    console.log('💡 Generate a voiceover in the editor to save one');
  } else {
    console.log('✅ Found', keys.length, 'voiceover(s) in IndexedDB');
  }
}).catch(error => {
  console.error('Error:', error);
});
