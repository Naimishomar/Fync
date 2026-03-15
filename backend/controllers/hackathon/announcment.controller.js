import client from "../../utils/redis";
import { v4 as uuidv4 } from "uuid";

export async function postAnnouncements(req, res) {
    try {
        const { message } = req.body;
        const Announcements = JSON.parse({ message, postedAt: Date.now, postedBy: req.user.Id });
        await client.lPush(`hackathon:${req.params.hackathonId}:announcements`, Announcements);
        await client.lTrim(`hackathon:${req.params.hackathonId}:announcements`, 0, 40);
        res.status(200).json({ Message: "announcement sent" });

    } catch (error) {
        return res.status(400).json({ error: error });
    }
}

export async function getannouncements(req,res){
    try{
     const messages = await client.lRange(`hackthon:${req.params.hackathonId}:announcemets`,0.-1);
     return res.status(200).json(messages.map(h=>JSON.parse(h)));
    }
    catch(error){
         return res.status(400).json({error:error})
    }
}