import {v4 as uuidv4} from "uuid";

const createAnnouncemenst = (data)=>({
    message:data.message,
    hackathonId:data.hackathonId,
    postedAt:Date.now(),
    PostedBy:uuidv4()
})
export default createAnnouncemenst;