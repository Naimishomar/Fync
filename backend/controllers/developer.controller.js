import User from '../models/user.model.js';

export const getDevelopers = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { type, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let query = { 
            _id: { $ne: currentUserId },
            user_access: { $ne: 'alumni' }
        };

        if (type === 'college') {
            const currentUser = await User.findById(currentUserId);
            if (!currentUser || !currentUser.college) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Update your profile with your college name first." 
                });
            }
            query.college = { $regex: new RegExp(`^${currentUser.college}$`, "i") };
        }

        // Was a flat .limit(50) with no offset, so the client had no way to reach
        // developer 51 and paid for all 50 on first paint. Same page/pagination
        // shape as getAlumni so the client can share one infinite-scroll pattern.
        const [developers, total] = await Promise.all([
            User.find(query)
                .select('name username avatar skills experience about college year major github_id linkedIn_id hobbies interest')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            User.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            count: developers.length,
            developers,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error("Developer Feed Error:", error);
        return res.status(500).json({ success: false, message: "Server error fetching developers" });
    }
};