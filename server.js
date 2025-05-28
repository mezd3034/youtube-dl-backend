const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// مسیر موقت برای فایل‌ها
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// API برای دریافت اطلاعات ویدیو
app.post('/api/info', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL معتبر نیست' });
    }

    try {
        const command = `${path.join(__dirname, 'bin', 'yt-dlp')} --dump-json "${url}"`;
        const output = execSync(command, { encoding: 'utf8' });
        const videoInfo = JSON.parse(output);

        const response = {
            thumbnail: videoInfo.thumbnail || '',
            title: videoInfo.title || 'بدون عنوان',
            channel: videoInfo.uploader || 'بدون کانال',
            views: videoInfo.view_count || '0',
            date: videoInfo.upload_date || 'نامشخص',
            duration: Math.floor(videoInfo.duration / 60) + ':' + ('0' + (videoInfo.duration % 60)).slice(-2),
            quality: 'HD',
            description: videoInfo.description || 'بدون توضیحات',
            formats: videoInfo.formats.map(f => ({
                format_id: f.format_id,
                ext: f.ext,
                quality: f.format_note || 'Unknown',
                size: f.filesize ? (f.filesize / 1048576).toFixed(2) + ' MB' : 'Unknown'
            }))
        };
        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'خطا در دریافت اطلاعات ویدیو' });
    }
});

// API برای دانلود و آپلود به هاست اصلی
app.post('/api/download', async (req, res) => {
    const { url, format_id } = req.body;
    if (!url || !format_id) {
        return res.status(400).json({ error: 'Missing URL or format_id' });
    }

    const outputFile = path.join(tempDir, `video-${Date.now()}.${format_id.includes('audio') ? 'mp3' : 'mp4'}`);
    try {
        const command = `${path.join(__dirname, 'bin', 'yt-dlp')} -f ${format_id} -o "${outputFile}" "${url}"`;
        execSync(command);

        const fileStream = fs.createReadStream(outputFile);
        const formData = new FormData();
        formData.append('file', fileStream, path.basename(outputFile));

        const uploadResponse = await axios.post('https://your-host.com/upload.php', formData, {
            headers: formData.getHeaders()
        });

        fs.unlinkSync(outputFile);

        res.json(uploadResponse.data);
    } catch (error) {
        console.error(error);
        if (fs.existsSync(outputFile)) {
            fs.unlinkSync(outputFile);
        }
        res.status(500).json({ error: 'Error downloading or uploading file' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});