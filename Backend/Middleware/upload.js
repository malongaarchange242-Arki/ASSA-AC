
// Middleware/upload.js
import multer from "multer";

// Utilisation exclusive de memoryStorage : indispensable sur Render
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max

    fileFilter: (req, file, cb) => {
        if (!file || !file.mimetype) {
            return cb(new Error("Fichier invalide"), false);
        }

        const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif"];

        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Format non autorisé. Formats acceptés : PNG, JPG, JPEG, GIF"), false);
        }

        cb(null, true);
    }
});

export default upload;

