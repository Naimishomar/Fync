import Hackathon from "../models/hackathon/hackathons.model";

const checkDeadLine = async(hackathonId)=>{
    const hackathon = await Hackathon.findById(hackathonId);
    return Date.now() > new Date(hackathon.hackathonends)
}

export default checkDeadLine;