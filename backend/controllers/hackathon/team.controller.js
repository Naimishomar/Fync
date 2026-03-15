import { v4 as uuidv4} from "uuid";
import client from "../../utils/redis";
import { json } from "express";

export async function createTeam(req,res){
    try{
     const { hackathonId , teamName } = req.body;
     const teamId = uuidv4();
     const alreadyinteam = await client.get(`user:${req.user.Id}:team`);
     if(alreadyinteam) return res.status(401).json({message:"already in team"});
     const team = { teamId , hackathonId , teamName , leaderId:req.user.Id , createdAt:Date.now()}
     // this is to create a  team table with key team:teamId
     await client.set(`team:${teamId}`,JSON.stringify(team));
     // this is to create a members table for a particular team with key team:userId:members 
     await client.sAdd(`team:${teamId}:members`,req.user.Id);
     // this is to create a table to know user kitni teams me exists krta hai... 
     await client.set(`user:${res.user.Id}:team`,teamId);
     return res.status(200).json({teamId});
    }
    catch(error){
        res.status(400).json({
            message:"Something went wrong",
            error:error
        })
    }
}

export async function joinTeam(req,res){
    try{
     const { teamId } = req.params;
     const teamData = await client.get(`team:${teamId}`);
     if(!teamData) return res.status(401).json({error:"team not found"});
     const team = JSON.parse(teamData);

     const Membercount = await client.sCard(`team:${teamId}:members`);
     const hackathondetail = await client.get(`hackathon:${team.hackathonId}`);
     if(hackathondetail.maxTeamSize <= Membercount){
         return res.status(401).send({error:"Team is full"});
     }

     await client.sAdd(`team:${teamId}:members`,req.user.Id);
     await client.set(`user:${req.user.Id}:team`,teamId);
     return res.status(200).send({message:"Team Member Added successfully"});
    }
    catch(error){
       return res.status(400).json({
        message:"something went wrong",
        error:error
       })
    }
}

export async function totalTeamMembers(req ,res) {
    try{
    const {teamId} = req.params;
    const members = await client.sMembers(`team:${teamId}:members`); 
    // this will return total number of members in the team:teamId:members set 
    return res.status(200).send(members);
    }catch(error){
        return res.status(400).json({message:"something went wrong",error:error});
    }
}