import {v4 as uuidv4}  from "uuid";
import client from "../../utils/redis";

export async function createhackathon(req,res){
     const {title , description , startTime , endTime , maxTeamSize} = req.body;
     const hackathonId = uuidv4();
     const hackathon = {hackathonId , title , description , startTime , endTime , maxTeamSize , createdBy:req.user.id , status:"upcoming"};
     // adding the hackathon details to the db
     await client.set(`hackthon:${hackathonId}`,JSON.stringify(hackathon));
     // one more entry for upcoming hackathons
     await client.zAdd("hackathons:upcoming",Date.parse(startTime),hackathonId);
     res.status(200).JSON({hackathonID:hackathonId});
}

export async function gethackathondetails(req,res){
    try{
     const response = await client.get(`hackathon:${req.params.hackathonId}`);
     if(!response) return res.status(401).json({message:"Not found"});
     return res.status(200).json(JSON.parse(response));
    }
    catch(error){ 
       res.status(400).send(error);
    }
}

export async function getupcominghackathons(req,res){
    try{
       const data = await client.zrange("hackathons:upcoming",0,-1); // this will return you the hackathons id in array...
       const hackathons = await Promise.all(data.map(id=>client.get(`hackathon:${id}`)));
       res.json(hackathons.map(h=>JSON.parse(h))); 
    }
    catch(error){
        res.status(400).json({
            message:"Something went wrong",
            error:error
        })
    }
}