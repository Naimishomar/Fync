import Ad from '../models/ad.model.js';
import { uploadToR2, deleteFromR2 } from '../utils/r2.js';

export const getAds = async (req, res) => {
    try {
        const ads = await Ad.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
        return res.status(200).json({ success: true, ads });
    } catch (error) {
        console.error('Get ads error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const getAllAds = async (req, res) => {
    try {
        if (req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admins only' });
        }
        const ads = await Ad.find().sort({ order: 1, createdAt: -1 }).populate('createdBy', 'name');
        return res.status(200).json({ success: true, ads });
    } catch (error) {
        console.error('Get all ads error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const createAd = async (req, res) => {
    try {
        if (req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admins only' });
        }

        const { title, linkUrl, imageUrl: bodyImageUrl } = req.body;

        let imageUrl = bodyImageUrl || null;

        if (req.file) {
            imageUrl = await uploadToR2(
                req.file.buffer,
                'ads',
                req.file.originalname,
                req.file.mimetype
            );
        }

        if (!imageUrl) {
            return res.status(400).json({ success: false, message: 'Image is required (upload a file or provide an image URL)' });
        }

        const ad = await Ad.create({
            imageUrl,
            title: title || null,
            linkUrl: linkUrl || null,
            createdBy: req.user.id,
        });

        return res.status(201).json({ success: true, ad, message: 'Ad created!' });
    } catch (error) {
        console.error('Create ad error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const updateAd = async (req, res) => {
    try {
        if (req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admins only' });
        }

        const ad = await Ad.findById(req.params.id);
        if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

        const { title, linkUrl, isActive, imageUrl: bodyImageUrl } = req.body;

        let imageUrl = ad.imageUrl;

        if (req.file) {
            imageUrl = await uploadToR2(
                req.file.buffer,
                'ads',
                req.file.originalname,
                req.file.mimetype
            );
            if (ad.imageUrl && ad.imageUrl.includes(process.env.R2_PUBLIC_URL)) {
                await deleteFromR2(ad.imageUrl);
            }
        } else if (bodyImageUrl && bodyImageUrl !== ad.imageUrl) {
            imageUrl = bodyImageUrl;
        }

        const updated = await Ad.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    imageUrl,
                    ...(title !== undefined && { title }),
                    ...(linkUrl !== undefined && { linkUrl }),
                    ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
                }
            },
            { new: true }
        );

        return res.status(200).json({ success: true, ad: updated, message: 'Ad updated!' });
    } catch (error) {
        console.error('Update ad error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const deleteAd = async (req, res) => {
    try {
        if (req.user.user_access !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admins only' });
        }

        const ad = await Ad.findByIdAndDelete(req.params.id);
        if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

        if (ad.imageUrl && ad.imageUrl.includes(process.env.R2_PUBLIC_URL)) {
            await deleteFromR2(ad.imageUrl);
        }

        return res.status(200).json({ success: true, message: 'Ad deleted!' });
    } catch (error) {
        console.error('Delete ad error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
