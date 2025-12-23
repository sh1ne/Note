import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './config';

export const uploadImage = async (
  file: File,
  userId: string,
  noteId: string
): Promise<string> => {
  // Compress image if needed
  const compressedFile = await compressImage(file);
  
  const fileName = `${userId}/${noteId}/${Date.now()}_${compressedFile.name}`;
  const storageRef = ref(storage, `images/${fileName}`);
  
  await uploadBytes(storageRef, compressedFile);
  const url = await getDownloadURL(storageRef);
  
  return url;
};

export const deleteImage = async (imageUrl: string) => {
  const imageRef = ref(storage, imageUrl);
  await deleteObject(imageRef);
};

const compressImage = async (file: File, maxWidth = 1920, quality = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
    };
  });
};

