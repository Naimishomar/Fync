import {v4 as uuidv4 } from "uuid";

const createUser = (data)=>({
     userId:uuidv4(),
     name:data.username,
     email:data.email,
     password:data.password,
     role:data.role || "participants",
     createdAt:Date.now()
})
export default createUser;