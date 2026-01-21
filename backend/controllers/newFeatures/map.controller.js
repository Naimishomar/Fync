import Map from "../../models/newFeatures/map.model.js";

export const saveLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const map = await Map.create({
            college: req.user.college,
            lat: Number(lat.toFixed(4)),
            lng: Number(lng.toFixed(4))
        });
        return res.status(200).json({ success: true, message: "Location saved successfully." });
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

export const getHeatMap = async(req,res)=>{
    try {
        const data = await Map.aggregate([{ $match: { college: req.user.college } },
            { $group: {
                _id: { lat: "$lat", lng: "$lng" },
                count: { $sum: 1 }
            }}
        ]);
        res.status(200).json(data.map(d => ({ lat: d._id.lat, lng: d._id.lng, count: d.count })));
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
}