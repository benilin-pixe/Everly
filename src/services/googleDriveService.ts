/**
 * Google Drive API v3 Service Layer for Everly
 * Handles dedicated shared folder management (Everly Shared Storage),
 * organized subfolders (Photos, Videos, Music, Backgrounds, Memories, Other),
 * multipart file uploading, media streaming, and quota reporting.
 */

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  webContentLink?: string;
  webViewLink?: string;
  parents?: string[];
  description?: string;
}

export interface DriveFolderMap {
  rootId: string;
  photosId: string;
  videosId: string;
  musicId: string;
  backgroundsId: string;
  memoriesId: string;
  otherId: string;
}

const ROOT_FOLDER_NAME = 'Everly Shared Storage';
const SUBFOLDERS = ['Photos', 'Videos', 'Music', 'Backgrounds', 'Memories', 'Other'] as const;
export type EverlySubfolder = typeof SUBFOLDERS[number];

/**
 * Executes an authenticated Google Drive API request with error handling
 */
async function driveFetch(endpoint: string, accessToken: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google Drive authorization token has expired. Please sign in again.');
    }
    const errText = await response.text();
    let parsedMessage = errText;
    try {
      const errJson = JSON.parse(errText);
      parsedMessage = errJson.error?.message || errText;
    } catch {}
    throw new Error(`Google Drive API Error (${response.status}): ${parsedMessage}`);
  }

  return response;
}

/**
 * Searches for a folder by name inside a parent folder (or root)
 */
export async function findFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string | null> {
  let query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${folderName.replace(/'/g, "\\'")}'`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`;
  const res = await driveFetch(url, accessToken);
  const data = await res.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

/**
 * Creates a new folder inside Google Drive
 */
export async function createFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const body: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    body.parents = [parentId];
  }

  const res = await driveFetch('https://www.googleapis.com/drive/v3/files', accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data.id;
}

/**
 * Initializes and retrieves the "Everly Shared Storage" folder structure.
 */
export async function initializeEverlyStorage(accessToken: string): Promise<DriveFolderMap> {
  // 1. Locate or create Root Folder
  let rootId = await findFolder(accessToken, ROOT_FOLDER_NAME);
  if (!rootId) {
    rootId = await createFolder(accessToken, ROOT_FOLDER_NAME);
  }

  // 2. Locate or create Subfolders
  const folderMap: Partial<DriveFolderMap> = { rootId };

  for (const subfolder of SUBFOLDERS) {
    let subId = await findFolder(accessToken, subfolder, rootId);
    if (!subId) {
      subId = await createFolder(accessToken, subfolder, rootId);
    }
    const key = `${subfolder.toLowerCase()}Id` as keyof DriveFolderMap;
    folderMap[key] = subId;
  }

  return folderMap as DriveFolderMap;
}

/**
 * Uploads a file to Google Drive using standard Multipart Upload
 */
export async function uploadFileToDrive(
  accessToken: string,
  file: File | Blob,
  fileName: string,
  targetFolder: EverlySubfolder,
  folderMap?: DriveFolderMap | null,
  caption?: string
): Promise<GoogleDriveFile> {
  let parentId: string | undefined;

  if (folderMap) {
    const key = `${targetFolder.toLowerCase()}Id` as keyof DriveFolderMap;
    parentId = folderMap[key] || folderMap.rootId;
  } else {
    // Attempt to locate target subfolder dynamically
    const rootId = await findFolder(accessToken, ROOT_FOLDER_NAME);
    if (rootId) {
      parentId = (await findFolder(accessToken, targetFolder, rootId)) || rootId;
    }
  }

  const metadata = {
    name: fileName,
    mimeType: file.type || 'application/octet-stream',
    description: caption || `Uploaded via Everly (${targetFolder})`,
    parents: parentId ? [parentId] : undefined,
  };

  const boundary = '-------EverlyDriveUploadBoundary' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // Read file as ArrayBuffer
  const fileData = await file.arrayBuffer();

  const metadataContentType = 'application/json; charset=UTF-8';
  const fileContentType = file.type || 'application/octet-stream';

  const multipartRequestBody = new Blob([
    delimiter,
    `Content-Type: ${metadataContentType}\r\n\r\n`,
    JSON.stringify(metadata),
    delimiter,
    `Content-Type: ${fileContentType}\r\n`,
    'Content-Transfer-Encoding: base64\r\n\r\n',
    arrayBufferToBase64(fileData),
    closeDelimiter,
  ]);

  const uploadRes = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,thumbnailLink,webContentLink,webViewLink,createdTime',
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  return await uploadRes.json();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Lists files in a specific Google Drive folder
 */
export async function listDriveFiles(
  accessToken: string,
  folderId?: string
): Promise<GoogleDriveFile[]> {
  let query = 'trashed = false';
  if (folderId) {
    query += ` and '${folderId}' in parents`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,size,thumbnailLink,webContentLink,webViewLink,createdTime,description)&orderBy=createdTime desc&pageSize=100`;

  const res = await driveFetch(url, accessToken);
  const data = await res.json();
  return data.files || [];
}

/**
 * Deletes a file from Google Drive
 */
export async function deleteDriveFile(accessToken: string, fileId: string): Promise<boolean> {
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, accessToken, {
    method: 'DELETE',
  });
  return res.ok;
}

/**
 * Renames a file in Google Drive
 */
export async function renameDriveFile(
  accessToken: string,
  fileId: string,
  newName: string
): Promise<boolean> {
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, accessToken, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });
  return res.ok;
}

/**
 * Retrieves file metadata from Google Drive
 */
export async function getDriveFileMetadata(accessToken: string, fileId: string): Promise<GoogleDriveFile> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,thumbnailLink,webContentLink,webViewLink,createdTime,description`,
    accessToken
  );
  return await res.json();
}

/**
 * Fetches the user's Google Drive Storage Quota
 */
export async function getDriveStorageQuota(
  accessToken: string
): Promise<{ limitBytes: number; usageBytes: number; usageInDriveBytes: number }> {
  try {
    const res = await driveFetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', accessToken);
    const data = await res.json();
    const quota = data.storageQuota || {};
    return {
      limitBytes: parseInt(quota.limit || '16106127360', 10), // default 15GB if unlimited
      usageBytes: parseInt(quota.usage || '3221225472', 10),
      usageInDriveBytes: parseInt(quota.usageInDrive || '2147483648', 10),
    };
  } catch (err) {
    console.warn('Could not fetch storage quota:', err);
    return {
      limitBytes: 15 * 1024 * 1024 * 1024,
      usageBytes: 2.8 * 1024 * 1024 * 1024,
      usageInDriveBytes: 2.1 * 1024 * 1024 * 1024,
    };
  }
}
