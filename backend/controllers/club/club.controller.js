import Club from '../../models/club/club.model.js';
import SubGroup from '../../models/club/subGroup.model.js';
import ClubMessage from '../../models/club/clubMessage.model.js';
import User from '../../models/user.model.js';
import { uploadToR2, deleteFromR2 } from '../../utils/r2.js';

// Robust membership check that handles String vs ObjectId comparison.
const hasId = (arr, id) => Array.isArray(arr) && id != null && arr.some(x => String(x) === String(id));

const generateUniqueJoinCode = async () => {
    let code;
    let exists = true;
    while (exists) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        exists = await Club.exists({ joinCode: code });
    }
    return code;
};

/**
 * Super Admin (user_access: 'admin') can create clubs.
 */
export const createClub = async (req, res) => {
    try {
        const { name, description, category } = req.body;
        const creatorId = req.user?.id || req.user?._id;
        if (!creatorId) return res.status(401).json({ success: false, message: "Unauthorized" });
        
        const existing = await Club.findOne({ name });
        if (existing) return res.status(400).json({ success: false, message: "Club name already exists" });

        const logoUrl = req.files?.logo?.[0] 
            ? await uploadToR2(req.files.logo[0].buffer, 'clubs/logos', req.files.logo[0].originalname, req.files.logo[0].mimetype) 
            : null;
        const bannerUrl = req.files?.banner?.[0] 
            ? await uploadToR2(req.files.banner[0].buffer, 'clubs/banners', req.files.banner[0].originalname, req.files.banner[0].mimetype) 
            : null;

        const joinCode = await generateUniqueJoinCode();

        const club = await Club.create({
            name,
            description,
            creator: creatorId,
            admins: [creatorId],
            members: [creatorId],
            logo: logoUrl,
            banner: bannerUrl,
            category,
            joinCode
        });

        // Auto-create General SubGroup
        const generalRoom = await SubGroup.create({
            clubId: club._id,
            name: "General",
            description: "Community town hall for all members.",
            isGeneral: true,
            members: [creatorId],
            admins: [creatorId]
        });

        club.subGroups.push(generalRoom._id);
        await club.save();

        return res.status(201).json({ success: true, club });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Club Admins can create sub-groups.
 */
export const createSubGroup = async (req, res) => {
    try {
        const { clubId, name, description, type } = req.body;
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        
        const club = await Club.findById(clubId);
        if (!club) return res.status(404).json({ success: false, message: "Club not found" });

        if (!hasId(club.admins, adminId)) {
            return res.status(403).json({ success: false, message: "Only Club Admins can create sub-groups" });
        }

        let logoUrl = null;
        if (req.file) {
            logoUrl = await uploadToR2(req.file.buffer, 'subgroups/logos', req.file.originalname, req.file.mimetype);
        }

        const subGroup = await SubGroup.create({
            clubId,
            name,
            description,
            type: type || 'chat',
            logo: logoUrl,
            members: [adminId],
            admins: [adminId]
        });

        club.subGroups.push(subGroup._id);
        await club.save();

        return res.status(201).json({ success: true, subGroup });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateClub = async (req, res) => {
    try {
        const { clubId, name, description, category, isJoinCodeEnabled } = req.body;
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const club = await Club.findById(clubId);
        
        if (!hasId(club.admins, adminId)) return res.status(403).json({ success: false, message: "Unauthorized" });

        if (name) club.name = name;
        if (description) club.description = description;
        if (category) club.category = category;
        if (isJoinCodeEnabled !== undefined) {
            club.isJoinCodeEnabled = isJoinCodeEnabled === 'true' || isJoinCodeEnabled === true;
        }

        if (req.files) {
            if (req.files.logo?.[0]) {
                if (club.logo) {
                    const oldLogo = club.logo.split('/').pop();
                    await deleteFromR2('clubs/logos', oldLogo);
                }
                club.logo = await uploadToR2(req.files.logo[0].buffer, 'clubs/logos', req.files.logo[0].originalname, req.files.logo[0].mimetype);
            }
            if (req.files.banner?.[0]) {
                if (club.banner) {
                    const oldBanner = club.banner.split('/').pop();
                    await deleteFromR2('clubs/banners', oldBanner);
                }
                club.banner = await uploadToR2(req.files.banner[0].buffer, 'clubs/banners', req.files.banner[0].originalname, req.files.banner[0].mimetype);
            }
        }

        await club.save();
        return res.status(200).json({ success: true, club });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSubGroup = async (req, res) => {
    try {
        const { subGroupId, name, description, onlyAdminsCanMessage } = req.body;
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const subGroup = await SubGroup.findById(subGroupId).populate('clubId');
        
        const isClubAdmin = hasId(subGroup.clubId.admins, adminId);
        const isSubAdmin = hasId(subGroup.admins, adminId);
        
        if (!isClubAdmin && !isSubAdmin) return res.status(403).json({ success: false, message: "Unauthorized" });

        if (name) subGroup.name = name;
        if (description) subGroup.description = description;
        if (onlyAdminsCanMessage !== undefined) {
            subGroup.onlyAdminsCanMessage = onlyAdminsCanMessage === 'true' || onlyAdminsCanMessage === true;
        }

        if (req.file) {
            if (subGroup.logo) {
                const oldLogo = subGroup.logo.split('/').pop();
                await deleteFromR2('subgroups/logos', oldLogo);
            }
            subGroup.logo = await uploadToR2(req.file.buffer, 'subgroups/logos', req.file.originalname, req.file.mimetype);
        }

        await subGroup.save();
        return res.status(200).json({ success: true, subGroup });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getSubGroupMembers = async (req, res) => {
    try {
        const { subGroupId } = req.params;
        const subGroup = await SubGroup.findById(subGroupId)
            .populate('members', 'name username avatar')
            .populate('admins', '_id')
            .populate('joinRequests', 'name username avatar');
            
        return res.status(200).json({ 
            success: true, 
            members: subGroup.members, 
            admins: subGroup.admins,
            joinRequests: subGroup.joinRequests
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const toggleSubGroupAdmin = async (req, res) => {
    try {
        const { subGroupId, targetUserId } = req.body;
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const subGroup = await SubGroup.findById(subGroupId).populate('clubId');

        // Only Main Club Admins can toggle Sub-Admins
        if (!hasId(subGroup.clubId.admins, adminId)) {
            return res.status(403).json({ success: false, message: "Only Main Club Admins can assign Room Leaders" });
        }

        const isAdmin = hasId(subGroup.admins, targetUserId);
        if (isAdmin) {
            subGroup.admins = subGroup.admins.filter(id => id.toString() !== targetUserId.toString());
        } else {
            subGroup.admins.push(targetUserId);
        }

        await subGroup.save();
        return res.status(200).json({ success: true, message: isAdmin ? "Demoted from Room Leader" : "Promoted to Room Leader" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Membership Management
 */
export const requestToJoinClub = async (req, res) => {
    try {
        const { clubId } = req.body;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const club = await Club.findById(clubId);
        
        if (hasId(club.members, userId)) return res.status(400).json({ success: false, message: "Already a member" });
        if (hasId(club.joinRequests, userId)) return res.status(400).json({ success: false, message: "Request already pending" });

        club.joinRequests.push(userId);
        await club.save();
        
        return res.status(200).json({ success: true, message: "Join request sent to Admins" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const handleJoinRequest = async (req, res) => {
    try {
        const { clubId, userId, action } = req.body; // action: 'approve' | 'reject'
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const club = await Club.findById(clubId);

        if (!hasId(club.admins, adminId)) return res.status(403).json({ success: false, message: "Unauthorized" });

        if (action === 'approve') {
            if (!hasId(club.members, userId)) {
                club.members.push(userId);
                
                // Auto-join General SubGroup
                const generalRoom = await SubGroup.findOne({ clubId, isGeneral: true });
                if (generalRoom && !hasId(generalRoom.members, userId)) {
                    generalRoom.members.push(userId);
                    await generalRoom.save();
                }
            }
        }
        
        club.joinRequests = club.joinRequests.filter(id => id.toString() !== userId);
        await club.save();

        return res.status(200).json({ success: true, message: `Request ${action}ed` });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Toggle Admin Status (Promote/Demote)
 * Regular admins can PROMOTE.
 * Only Super Admin (Creator) can DEMOTE.
 */
export const toggleClubAdmin = async (req, res) => {
    try {
        const { clubId, targetUserId } = req.body;
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const club = await Club.findById(clubId);
        if (!club) return res.status(404).json({ success: false, message: "Club not found" });

        // Basic Admin Check
        if (!hasId(club.admins, adminId)) return res.status(403).json({ success: false, message: "Unauthorized" });

        const isCurrentlyAdmin = hasId(club.admins, targetUserId);

        if (!isCurrentlyAdmin) {
            // Promotion logic: ANY admin can promote a member
            if (!hasId(club.members, targetUserId)) return res.status(400).json({ success: false, message: "User must be a member first" });
            club.admins.push(targetUserId);
            await club.save();
            return res.status(200).json({ success: true, message: "User promoted to Admin" });
        } else {
            // Demotion logic: ONLY Super Admin (Creator) can demote
            const isSuperAdmin = club.creator.toString() === adminId.toString();
            if (!isSuperAdmin) {
                return res.status(403).json({ success: false, message: "Only the Club Creator (Super Admin) can revoke administrative privileges." });
            }

            // Prevent self-demotion
            if (targetUserId.toString() === adminId.toString()) {
                return res.status(400).json({ success: false, message: "You cannot revoke your own Super Admin status." });
            }

            club.admins = club.admins.filter(id => id.toString() !== targetUserId.toString());
            await club.save();
            return res.status(200).json({ success: true, message: "Administrative access revoked." });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getClubDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const club = await Club.findById(id)
            .populate('creator', 'name username avatar')
            .populate('members', 'name username avatar')
            .populate('admins', 'name username avatar')
            .populate('joinRequests', 'name username avatar')
            .populate('invitations', 'name username avatar')
            .populate('subGroups');
            
        if (!club) return res.status(404).json({ success: false, message: "Club not found" });

        return res.status(200).json({ success: true, club });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllClubs = async (req, res) => {
    try {
        const userId = req.query.userId || req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        // Only show clubs where user is member, admin, or invited
        const clubs = await Club.find({
            $or: [
                { members: userId },
                { admins: userId },
                { invitations: userId }
            ]
        }).populate('creator', 'name username avatar');

        return res.status(200).json({ success: true, clubs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Invitations
 */
export const inviteUser = async (req, res) => {
    try {
        const { clubId, targetUserId } = req.body;
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const club = await Club.findById(clubId);
        if (!hasId(club.admins, adminId)) return res.status(403).json({ success: false, message: "Unauthorized" });

        if (hasId(club.members, targetUserId)) return res.status(400).json({ success: false, message: "User already a member" });
        if (hasId(club.invitations, targetUserId)) return res.status(400).json({ success: false, message: "User already invited" });

        club.invitations.push(targetUserId);
        await club.save();

        return res.status(200).json({ success: true, message: "Invitation sent" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const acceptInvitation = async (req, res) => {
    try {
        const { clubId } = req.body;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const club = await Club.findById(clubId);
        
        if (!hasId(club.invitations, userId)) return res.status(400).json({ success: false, message: "No invitation found" });

        club.members.push(userId);
        club.invitations = club.invitations.filter(id => id.toString() !== userId);
        
        // Auto-join General SubGroup
        const generalRoom = await SubGroup.findOne({ clubId, isGeneral: true });
        if (generalRoom && !hasId(generalRoom.members, userId)) {
            generalRoom.members.push(userId);
            await generalRoom.save();
        }

        await club.save();

        return res.status(200).json({ success: true, message: "Welcome to the club!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const searchUserForInvite = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(200).json({ success: true, users: [] });

        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const users = await User.find({
            $or: [
                { username: { $regex: safeQuery, $options: 'i' } },
                { name: { $regex: safeQuery, $options: 'i' } }
            ]
        }).select('name username avatar').limit(10);

        return res.status(200).json({ success: true, users });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const joinByCode = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ success: false, message: "Code required" });

        const club = await Club.findOne({ joinCode: code });
        if (!club) return res.status(404).json({ success: false, message: "Club not found with this code" });

        if (!club.isJoinCodeEnabled) {
            return res.status(403).json({ success: false, message: "Joining by code is currently disabled for this club" });
        }

        return res.status(200).json({ success: true, clubId: club._id, name: club.name });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const joinSubGroup = async (req, res) => {
    try {
        const { subGroupId } = req.body;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const subGroup = await SubGroup.findById(subGroupId);
        if (!subGroup) return res.status(404).json({ success: false, message: "Room not found" });

        if (hasId(subGroup.members, userId)) {
            return res.status(400).json({ success: false, message: "Already a member of this room" });
        }

        if (hasId(subGroup.joinRequests, userId)) {
            return res.status(400).json({ success: false, message: "Request already pending for this room" });
        }

        subGroup.joinRequests.push(userId);
        await subGroup.save();

        return res.status(200).json({ success: true, message: "Join request sent to room admins" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const handleSubGroupJoinRequest = async (req, res) => {
    try {
        const { subGroupId, userId, action } = req.body; // action: 'approve' | 'reject'
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const subGroup = await SubGroup.findById(subGroupId).populate('clubId');
        if (!subGroup) return res.status(404).json({ success: false, message: "Room not found" });

        const isClubAdmin = hasId(subGroup.clubId.admins, adminId);
        const isSubAdmin = hasId(subGroup.admins, adminId);
        if (!isClubAdmin && !isSubAdmin) return res.status(403).json({ success: false, message: "Unauthorized" });

        if (action === 'approve') {
            if (!hasId(subGroup.members, userId)) {
                subGroup.members.push(userId);
            }
            subGroup.joinRequests = subGroup.joinRequests.filter(id => id.toString() !== userId.toString());
            await subGroup.save();
            return res.status(200).json({ success: true, message: "User approved and added to room" });
        } else if (action === 'reject') {
            subGroup.joinRequests = subGroup.joinRequests.filter(id => id.toString() !== userId.toString());
            await subGroup.save();
            return res.status(200).json({ success: true, message: "Join request rejected" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid action" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteSubGroup = async (req, res) => {
    try {
        const { subGroupId } = req.body;
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const subGroup = await SubGroup.findById(subGroupId).populate('clubId');
        if (!subGroup) return res.status(404).json({ success: false, message: "Room not found" });

        if (subGroup.isGeneral) {
            return res.status(400).json({ success: false, message: "General Hub cannot be deleted individually" });
        }

        const isClubAdmin = hasId(subGroup.clubId.admins, adminId);
        const isSubAdmin = hasId(subGroup.admins, adminId);
        if (!isClubAdmin && !isSubAdmin) return res.status(403).json({ success: false, message: "Unauthorized" });

        // 1. Delete Messages
        await ClubMessage.deleteMany({ subGroupId });

        // 2. Remove from Club list
        await Club.findByIdAndUpdate(subGroup.clubId._id, { $pull: { subGroups: subGroupId } });

        // 3. Purge Media
        if (subGroup.logo) {
            const oldLogo = subGroup.logo.split('/').pop();
            await deleteFromR2('subgroups/logos', oldLogo);
        }

        // 4. Delete SubGroup
        await SubGroup.findByIdAndDelete(subGroupId);

        return res.status(200).json({ success: true, message: "Room deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteClub = async (req, res) => {
    try {
        const { clubId } = req.body;
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const club = await Club.findById(clubId);
        if (!club) return res.status(404).json({ success: false, message: "Club not found" });

        if (!hasId(club.admins, adminId)) return res.status(403).json({ success: false, message: "Unauthorized" });

        // 1. Identify all SubGroups
        const subGroupIds = club.subGroups;

        // 2. Cascade Messages Deletion
        await ClubMessage.deleteMany({ subGroupId: { $in: subGroupIds } });

        // 3. Purge SubGroup Media & Documents
        const rooms = await SubGroup.find({ _id: { $in: subGroupIds } });
        for (const room of rooms) {
            if (room.logo) {
                const oldLogo = room.logo.split('/').pop();
                await deleteFromR2('subgroups/logos', oldLogo);
            }
        }
        await SubGroup.deleteMany({ _id: { $in: subGroupIds } });

        // 4. Purge Club Media
        if (club.logo) {
            const oldLogo = club.logo.split('/').pop();
            await deleteFromR2('clubs/logos', oldLogo);
        }
        if (club.banner) {
            const oldBanner = club.banner.split('/').pop();
            await deleteFromR2('clubs/banners', oldBanner);
        }

        // 5. Delete Club
        await Club.findByIdAndDelete(clubId);

        return res.status(200).json({ success: true, message: "Club deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const leaveClub = async (req, res) => {
    try {
        const { clubId } = req.body;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const club = await Club.findById(clubId);
        if (!club) return res.status(404).json({ success: false, message: "Club not found" });

        const isAdmin = hasId(club.admins, userId);
        if (isAdmin && club.admins.length === 1) {
            return res.status(400).json({ success: false, message: "You are the last Admin. Appoint a successor before leaving or delete the club." });
        }

        // 1. Remove from Club
        club.members = club.members.filter(id => id.toString() !== userId.toString());
        club.admins = club.admins.filter(id => id.toString() !== userId.toString());
        await club.save();

        // 2. Cascade remove from all SubGroups
        await SubGroup.updateMany(
            { clubId },
            { 
                $pull: { 
                    members: userId,
                    admins: userId
                } 
            }
        );

        return res.status(200).json({ success: true, message: "You have left the club." });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const leaveSubGroup = async (req, res) => {
    try {
        const { subGroupId } = req.body;
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const subGroup = await SubGroup.findById(subGroupId);
        if (!subGroup) return res.status(404).json({ success: false, message: "Room not found" });

        if (subGroup.isGeneral) {
            return res.status(400).json({ success: false, message: "You cannot leave the General Hub while in the club." });
        }

        subGroup.members = subGroup.members.filter(id => id.toString() !== userId.toString());
        subGroup.admins = subGroup.admins.filter(id => id.toString() !== userId.toString());
        await subGroup.save();

        return res.status(200).json({ success: true, message: "You have left the room." });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const removeFromClub = async (req, res) => {
    try {
        const { clubId, targetUserId } = req.body;
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const club = await Club.findById(clubId);
        if (!hasId(club.admins, adminId)) return res.status(403).json({ success: false, message: "Unauthorized" });

        if (hasId(club.admins, targetUserId)) {
            return res.status(403).json({ success: false, message: "Cannot remove an Admin. Demote them first." });
        }

        club.members = club.members.filter(id => id.toString() !== targetUserId.toString());
        await club.save();

        await SubGroup.updateMany(
            { clubId },
            { $pull: { members: targetUserId, admins: targetUserId } }
        );

        return res.status(200).json({ success: true, message: "Member removed from club and rooms." });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const removeFromSubGroup = async (req, res) => {
    try {
        const { subGroupId, targetUserId } = req.body;
        const adminId = req.user?.id || req.user?._id;
        if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });
        const subGroup = await SubGroup.findById(subGroupId).populate('clubId');
        
        const isClubAdmin = hasId(subGroup.clubId.admins, adminId);
        const isSubAdmin = hasId(subGroup.admins, adminId);
        if (!isClubAdmin && !isSubAdmin) return res.status(403).json({ success: false, message: "Unauthorized" });

        if (subGroup.isGeneral) return res.status(400).json({ success: false, message: "Cannot remove from General room. Remove from Club instead." });

        subGroup.members = subGroup.members.filter(id => id.toString() !== targetUserId.toString());
        subGroup.admins = subGroup.admins.filter(id => id.toString() !== targetUserId.toString());
        await subGroup.save();

        return res.status(200).json({ success: true, message: "Member removed from room." });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
