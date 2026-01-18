

export const fetchDriveData = async (folderId: string) => {
  const API_KEY = "AIzaSyD5JJ_U_15oSFtMMpkN9vl3phjXPRnU5_Y";
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.files) {
      console.error("Google Drive API Error:", data.error ? data.error.message : "Unknown Error");
      return [];
    }
    return data.files.sort((a: any, b: any) => {
      const isAFolder = a.mimeType === 'application/vnd.google-apps.folder';
      const isBFolder = b.mimeType === 'application/vnd.google-apps.folder';
      return isBFolder - isAFolder;
    });
  } catch (error) {
    console.error("Network or Fetch Error:", error);
    return [];
  }
};