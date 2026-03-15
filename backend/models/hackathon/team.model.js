import {v4 as uuidv4} from "uuid";
export const createTeam = (data)=>({
    teamName:data.teamName,
    leaderId:data.leaderId,
    hackathonId:data.hackathonId,
    teamId:uuidv4(),
    createdAt:Date.now()
})