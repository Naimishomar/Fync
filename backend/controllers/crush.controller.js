import Crush from '../models/crush.model.js';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';

// Haversine formula to calculate distance in meters
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

export const addCrush = async (req, res) => {
    try {
        const { crushUserId } = req.body;
        const userId = req.user.id;

        if (userId === crushUserId) {
            return res.status(400).json({ success: false, message: "You cannot add yourself as a crush!" });
        }

        // Check if already added
        const existingCrush = await Crush.findOne({ userId, crushUserId });
        if (existingCrush) {
            return res.status(400).json({ success: false, message: "Already in your secret crush list!" });
        }

        // Check for mutual crush
        const mutualCrush = await Crush.findOne({ userId: crushUserId, crushUserId: userId });

        const newCrush = await Crush.create({
            userId,
            crushUserId,
            isMutual: !!mutualCrush
        });

        if (mutualCrush) {
            // Update the mutual one as well
            mutualCrush.isMutual = true;
            await mutualCrush.save();

            // Notify both users of a match
            // (Socket notifications handled separately or via another service)
        }

        return res.status(200).json({ success: true, message: "Secret crush added!", isMutual: !!mutualCrush });
    } catch (error) {
        console.error("Add Crush Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMyCrushes = async (req, res) => {
    try {
        const userId = req.user.id;
        const crushes = await Crush.find({ userId }).populate("crushUserId", "name username avatar");

        // Filter out crushes where the user might have been deleted
        const filteredCrushes = crushes.filter(c => c.crushUserId);

        return res.status(200).json({ success: true, crushes: filteredCrushes });
    } catch (error) {
        console.error("Get My Crushes Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const removeCrush = async (req, res) => {
    try {
        const { crushId } = req.params;
        const userId = req.user.id;

        const crush = await Crush.findOne({ _id: crushId, userId });
        if (!crush) return res.status(404).json({ success: false, message: "Crush not found" });

        // If it was mutual, update the other one to no longer be mutual
        if (crush.isMutual) {
            const otherSide = await Crush.findOne({ userId: crush.crushUserId, crushUserId: userId });
            if (otherSide) {
                otherSide.isMutual = false;
                await otherSide.save();
            }
        }

        await Crush.findByIdAndDelete(crushId);
        return res.status(200).json({ success: true, message: "Crush removed" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateLocation = async (req, res) => {
    try {
        const { latitude, longitude, force = false } = req.body;
        const userId = req.user.id;

        const user = await User.findByIdAndUpdate(userId, {
            $set: {
                "location.latitude": latitude,
                "location.longitude": longitude,
                "location.lastUpdated": new Date()
            }
        }, { new: true });

        // Check for nearby crushes
        const myCrushes = await Crush.find({ userId }).populate('crushUserId', 'name username avatar location');
        const nearbyCrushes = [];
        const cooldownMs = 60 * 60 * 1000; // 1 hour cooldown for notifications

        for (const c of myCrushes) {
            const crushUser = c.crushUserId;
            if (crushUser?.location?.latitude) {
                const lastUpdated = new Date(crushUser.location.lastUpdated);
                const now = new Date();
                const isFresh = (now - lastUpdated) / 1000 / 60 / 60 < 24; // Location updated in last 24h

                if (!isFresh) continue;

                const distance = getDistance(
                    latitude, longitude,
                    crushUser.location.latitude, crushUser.location.longitude
                );

                console.log(`[DEBUG] Distance to crush ${crushUser.username}: ${distance.toFixed(2)}m (Threshold: 100m)`);

                // Check if they were already notified recently
                const lastNotified = c.lastNotifiedAt ? new Date(c.lastNotifiedAt).getTime() : 0;
                const isWithinCooldown = (now.getTime() - lastNotified) < cooldownMs;

                if (distance <= 100) { // Increased to 100m for better testing
                    // If it's a manual check (force = true), return it regardless of cooldown
                    if (force || !isWithinCooldown) {
                        nearbyCrushes.push({
                            crushId: c._id,
                            crushUserId: c.isMutual ? crushUser : { _id: crushUser._id, name: "Someone Special", username: "Secret" },
                            isMutual: c.isMutual,
                            distance
                        });

                        // Update lastNotifiedAt
                        c.lastNotifiedAt = new Date();
                        await c.save();
                    }
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: "Location updated",
            nearbyCount: nearbyCrushes.length,
            nearby: nearbyCrushes // Client will handle alerting
        });
    } catch (error) {
        console.error("Location Update Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const checkNearby = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        if (!user || !user.location?.latitude) {
            return res.status(400).json({ success: false, message: "User location not set" });
        }

        const myCrushes = await Crush.find({ userId }).populate('crushUserId', 'name username avatar');
        const nearby = [];

        for (const c of myCrushes) {
            const crushUser = await User.findById(c.crushUserId._id);
            if (crushUser?.location?.latitude) {
                // Check if crush location was updated recently (e.g. last 24 hours) to ensure it's not totally stale
                const lastUpdated = new Date(crushUser.location.lastUpdated);
                const now = new Date();
                if ((now - lastUpdated) / 1000 / 60 / 60 < 24) {
                    const dist = getDistance(
                        user.location.latitude, user.location.longitude,
                        crushUser.location.latitude, crushUser.location.longitude
                    );
                    if (dist <= 100) {
                        nearby.push({
                            isMutual: c.isMutual,
                            crushUserId: c.isMutual ? c.crushUserId : { _id: c.crushUserId._id, name: "Someone Special", username: "Secret" }
                        });
                    }
                }
            }
        }

        return res.status(200).json({ success: true, nearby });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
