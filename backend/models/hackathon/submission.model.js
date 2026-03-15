import {v4 as uuidv4} from "uuid";
const CreateSubmission = (data)=>({
       submissionId:uuidv4(),
       teamId:data.teamId,
       hackathonId:data.hackathonId,
       projectTitle:data.title,
       repoUrl:data.repoUrl,
       demoUrl:data.demoUrl,
       description:data.description,
       submittedAt:Date.now()
})
export default CreateSubmission;