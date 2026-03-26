import HackathonTeam from "../models/hackathon/team.model";
const verifyTeam = async (userId, teamId) => {
    const team = await HackathonTeam.findById(teamId);
    if (!team) {
        return { error: "Team doesn't exist" };
    }
    const isMember = team.members.some((f) => f.user.toString() === userId.toString());
    if (!isMember) {
        return { error: "You are not a member" }
    }
    return { team }
}
export default verifyTeam;