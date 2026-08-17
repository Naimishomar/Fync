

export const fetchDriveData = async (folderId: string) => {
  // Expo only inlines variables prefixed EXPO_PUBLIC_. The old name had no
  // prefix, so this was `undefined` at runtime and every request went out as
  // `&key=undefined` — the Drive browser has never worked in a build.
  const API_KEY = process.env.EXPO_PUBLIC_DRIVE_API_KEY;
  if (!API_KEY) {
    console.error('Google Drive: EXPO_PUBLIC_DRIVE_API_KEY is not set.');
    return [];
  }
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.files) {
      console.error("Google Drive API Error:", data.error ? data.error.message : "Unknown Error");
      return [];
    }
    return data.files.sort((a: any, b: any) => {
      const isAFolder:any = a.mimeType === 'application/vnd.google-apps.folder';
      const isBFolder:any = b.mimeType === 'application/vnd.google-apps.folder';
      return isBFolder - isAFolder;
    });
  } catch (error) {
    console.error("Network or Fetch Error:", error);
    return [];
  }
};
