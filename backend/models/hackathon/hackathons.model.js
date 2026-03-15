import { v4 as uuidv4 } from "uuid";
export const createHackathon = (data)=>({
   hackathonId:uuidv4,
   title:data.title,
   description:data.description,
   startTime:data.startTime,
   endTime:data.endTime,
   maxTeamSize:data.maxTeamSize || 4,
   createdBy:data.createdBy,
   status:"upcoming",
   createdAt:Date.now()
})


