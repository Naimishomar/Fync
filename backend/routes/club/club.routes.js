import express from 'express';
import { 
    createClub, 
    createSubGroup, 
    requestToJoinClub, 
    handleJoinRequest, 
    toggleClubAdmin, 
    getClubDetails, 
    getAllClubs,
    searchUserForInvite,
    inviteUser,
    acceptInvitation,
    updateClub,
    updateSubGroup,
    joinByCode,
    joinSubGroup,
    handleSubGroupJoinRequest,
    getSubGroupMembers,
    toggleSubGroupAdmin,
    deleteClub,
    deleteSubGroup,
    leaveClub,
    leaveSubGroup,
    removeFromClub,
    removeFromSubGroup
} from '../../controllers/club/club.controller.js';
import { 
    postClubMessage, 
    getClubMessages, 
    voteInPoll, 
    togglePinMessage 
} from '../../controllers/club/message.controller.js';
import { upload, videoUpload } from '../../utils/r2.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * Club & Sub-Group Management
 */
router.post('/create', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), createClub);
router.post('/update', authMiddleware, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateClub);
router.post('/subgroup/create', authMiddleware, upload.single('logo'), createSubGroup);
router.post('/subgroup/update', authMiddleware, upload.single('logo'), updateSubGroup);
router.post('/join-request', authMiddleware, requestToJoinClub);
router.post('/handle-request', authMiddleware, handleJoinRequest);
router.post('/toggle-admin', authMiddleware, toggleClubAdmin);
router.get('/all', authMiddleware, getAllClubs);
router.get('/search-users', authMiddleware, searchUserForInvite);
router.post('/join-by-code', authMiddleware, joinByCode);
router.post('/subgroup/join', authMiddleware, joinSubGroup);
router.post('/subgroup/handle-request', authMiddleware, handleSubGroupJoinRequest);
router.get('/subgroup/members/:subGroupId', authMiddleware, getSubGroupMembers);
router.post('/subgroup/toggle-admin', authMiddleware, toggleSubGroupAdmin);
router.post('/invite', authMiddleware, inviteUser);
router.post('/accept-invitation', authMiddleware, acceptInvitation);
router.post('/delete', authMiddleware, deleteClub);
router.post('/subgroup/delete', authMiddleware, deleteSubGroup);
router.post('/leave', authMiddleware, leaveClub);
router.post('/subgroup/leave', authMiddleware, leaveSubGroup);
router.post('/remove-member', authMiddleware, removeFromClub);
router.post('/subgroup/remove-member', authMiddleware, removeFromSubGroup);
router.get('/:id', authMiddleware, getClubDetails);

/**
 * Messaging & Features
 */
router.post('/message/post', authMiddleware, upload.single('file'), postClubMessage);
router.get('/messages/:subGroupId', authMiddleware, getClubMessages);
router.post('/poll/vote', authMiddleware, voteInPoll);
router.post('/message/pin', authMiddleware, togglePinMessage);

export default router;
