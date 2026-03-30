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

const router = express.Router();

/**
 * Club & Sub-Group Management
 */
router.post('/create', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), createClub);
router.post('/update', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateClub);
router.post('/subgroup/create', upload.single('logo'), createSubGroup);
router.post('/subgroup/update', upload.single('logo'), updateSubGroup);
router.post('/join-request', requestToJoinClub);
router.post('/handle-request', handleJoinRequest);
router.post('/toggle-admin', toggleClubAdmin);
router.get('/all', getAllClubs);
router.get('/search-users', searchUserForInvite);
router.post('/join-by-code', joinByCode);
router.post('/subgroup/join', joinSubGroup);
router.post('/subgroup/handle-request', handleSubGroupJoinRequest);
router.get('/subgroup/members/:subGroupId', getSubGroupMembers);
router.post('/subgroup/toggle-admin', toggleSubGroupAdmin);
router.post('/invite', inviteUser);
router.post('/accept-invitation', acceptInvitation);
router.post('/delete', deleteClub);
router.post('/subgroup/delete', deleteSubGroup);
router.post('/leave', leaveClub);
router.post('/subgroup/leave', leaveSubGroup);
router.post('/remove-member', removeFromClub);
router.post('/subgroup/remove-member', removeFromSubGroup);
router.get('/:id', getClubDetails);

/**
 * Messaging & Features
 */
router.post('/message/post', upload.single('file'), postClubMessage);
router.get('/messages/:subGroupId', getClubMessages);
router.post('/poll/vote', voteInPoll);
router.post('/message/pin', togglePinMessage);

export default router;
