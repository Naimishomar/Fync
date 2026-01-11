import User from '../models/user.model.js';

export const getDevelopers = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { type } = req.query;

        let query = { 
            _id: { $ne: currentUserId }
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

        const developers = await User.find(query)
            .select('name username avatar skills experience about college year major github_id linkedIn_id hobbies interest')
            .limit(50)
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: developers.length,
            developers
        });

    } catch (error) {
        console.error("Developer Feed Error:", error);
        return res.status(500).json({ success: false, message: "Server error fetching developers" });
    }
};