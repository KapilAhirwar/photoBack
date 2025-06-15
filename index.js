// const express = require('express');
// const multer = require('multer');
// const sharp = require('sharp');
// const fs = require('fs');
// const path = require('path');
// const cors = require('cors');

// const app = express();
// const upload = multer({ dest: 'uploads/' });

// const corsOptions = {
//     origin:['http://localhost:3000', 'https://bestshop-three.vercel.app/','https://bestshop-three.vercel.app'],
//     credentials:true
// }

// app.use(cors(corsOptions));

// app.post('/convert', upload.single('image'), async (req, res) => {
//     const { format, width, height, unit, dpi } = req.body;
//     const inputPath = req.file.path;
//     const outputFormat = format || 'jpeg';
    
//     let targetWidth = parseFloat(width);
//     let targetHeight = parseFloat(height);
    
//     const dpiVal = parseInt(dpi) || 72;
    
//     // Convert inch/cm to px
//     if (unit === 'inch') {
//         targetWidth = targetWidth * dpiVal;
//         targetHeight = targetHeight * dpiVal;
//     } else if (unit === 'cm') {
//         targetWidth = (targetWidth / 2.54) * dpiVal;
//         targetHeight = (targetHeight / 2.54) * dpiVal;
//     }

//     // Ensure converted directory exists
//     const convertedDir = path.join(__dirname, 'converted');
//     if (!fs.existsSync(convertedDir)) {
//         fs.mkdirSync(convertedDir);
//     }
    
//     const outputPath = `converted/${Date.now()}.${outputFormat}`;

//     try {
//         await sharp(inputPath)
//             .resize(Math.round(targetWidth), Math.round(targetHeight))
//             .withMetadata({ density: dpiVal })
//             .toFormat(outputFormat)
//             .toFile(outputPath);

//         const stats = fs.statSync(outputPath);
//         const sizeKB = (stats.size / 1024).toFixed(2);

//         res.json({
//             success: true,
//             message: 'Image converted',
//             downloadUrl: `/${outputPath}`,
//             sizeKB,
//             sizeMB: (sizeKB / 1024).toFixed(2),
//         });
//         // Cleanup
//         fs.unlinkSync(inputPath);
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('Error processing image');
//     }
// });

// app.use('/converted', express.static('converted'));

// app.get('/download/:filename', (req, res) => {
//   const filePath = path.join(__dirname, 'converted', req.params.filename);
//   console.log(filePath);
//   res.download(filePath); // This sets headers to force download
// });




// app.listen(5000, () => {
//     console.log('Server started on http://localhost:5000');
// });



const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

const corsOptions = {
    origin: ['http://localhost:3000', 'https://photoconverter.vercel.app'],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure converted directory exists
const convertedDir = path.join(__dirname, 'converted');
if (!fs.existsSync(convertedDir)) {
    fs.mkdirSync(convertedDir);
}

app.post('/convert', upload.single('image'), async (req, res) => {
    const { format, width, height, unit, dpi, targetSizeKB } = req.body;
    const inputPath = req.file.path;
    const outputFormat = format || 'jpeg';

    let targetWidth = parseFloat(width);
    let targetHeight = parseFloat(height);
    const dpiVal = parseInt(dpi) || 72;
    const targetKB = parseFloat(targetSizeKB);

    // Convert inch/cm to px
    if (unit === 'inch') {
        targetWidth *= dpiVal;
        targetHeight *= dpiVal;
    } else if (unit === 'cm') {
        targetWidth = (targetWidth / 2.54) * dpiVal;
        targetHeight = (targetHeight / 2.54) * dpiVal;
    }

    const tempOutput = path.join(__dirname, 'converted', `temp-${Date.now()}.${outputFormat}`);
    const finalOutput = path.join(__dirname, 'converted', `${Date.now()}.${outputFormat}`);

    console.log(tempOutput, finalOutput, targetKB);

    try {
        let quality = 80;
        let attempt = 0;
        const maxAttempts = 10;
        let finalSizeKB = 0;

        while (attempt < maxAttempts) {
            let transformer = sharp(inputPath)
                .resize(Math.round(targetWidth), Math.round(targetHeight))
                .withMetadata({ density: dpiVal });

            if (outputFormat === 'jpeg') {
                transformer = transformer.jpeg({ quality });
            } else if (outputFormat === 'webp') {
                transformer = transformer.webp({ quality });
            } else if (outputFormat === 'png') {
                transformer = transformer.png({ compressionLevel: Math.min(9, Math.round((100 - quality) / 10)) });
            }

            await transformer.toFile(tempOutput);
            const stats = fs.statSync(tempOutput);
            finalSizeKB = stats.size / 1024;

            if (!targetKB || finalSizeKB <= targetKB || quality <= 30) {
                break;
            }

            quality -= 10;
            attempt++;
        }

        fs.renameSync(tempOutput, finalOutput);

        res.json({
            success: true,
            message: 'Image converted and compressed',
            downloadUrl: `/converted/${path.basename(finalOutput)}`,
            sizeKB: finalSizeKB.toFixed(2),
            sizeMB: (finalSizeKB / 1024).toFixed(2),
        });

        fs.unlinkSync(inputPath);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing image');
    }
});

// Serve static files
app.use('/converted', express.static('converted'));

// Download endpoint
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'converted', req.params.filename);
    res.download(filePath);
});

app.listen(process.env.PORT, () => {
    console.log('Server started on http://localhost:5000');
});
