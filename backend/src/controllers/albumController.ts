import { Request, Response } from 'express';
import crypto from 'crypto';
import Album from '../models/Album';
import Photo from '../models/Photo';
import SharedAlbum from '../models/SharedAlbum';
import User from '../models/User';
import Notification from '../models/Notification';

export const createAlbum = async (req: any, res: Response) => {
  try {
    const { name, description } = req.body;
    const album = await Album.create({
      userId: req.user._id,
      name,
      description,
    });
    res.status(201).json(album);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAlbums = async (req: any, res: Response) => {
  try {
    const albums = await Album.find({ userId: req.user._id }).sort({ createdAt: -1 });
    const shared = await SharedAlbum.find({ 'members.userId': req.user._id }).populate('albumId');

    res.json({
      owned: albums,
      shared: shared.map((s) => s.albumId),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAlbumPhotos = async (req: any, res: Response) => {
  try {
    const album = await Album.findOne({ _id: req.params.id });
    if (!album) return res.status(404).json({ message: 'Album not found' });

    // Check if user is owner OR if album is shared with them
    const isOwner = album.userId.toString() === req.user._id.toString();
    
    let hasAccess = isOwner;
    if (!hasAccess) {
      const shared = await SharedAlbum.findOne({ albumId: album._id, 'members.userId': req.user._id });
      if (shared) hasAccess = true;
    }

    if (!hasAccess) return res.status(403).json({ message: 'Not authorized to view this album' });

    const photos = await Photo.find({ albumId: req.params.id, deleted: false }).sort({ uploadDate: -1 });
    res.json({ album, photos });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addPhotoToAlbum = async (req: any, res: Response) => {
  try {
    const { photoId } = req.body;
    const album = await Album.findOne({ _id: req.params.id, userId: req.user._id });
    if (!album) return res.status(404).json({ message: 'Album not found' });

    const photo = await Photo.findOne({ _id: photoId, userId: req.user._id });
    if (!photo) return res.status(404).json({ message: 'Photo not found' });

    photo.albumId = album._id as any;
    await photo.save();

    res.json({ message: 'Photo added to album' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const generateShareLink = async (req: any, res: Response) => {
  try {
    const album = await Album.findOne({ _id: req.params.id, userId: req.user._id });
    if (!album) return res.status(404).json({ message: 'Album not found' });

    if (!album.shareToken) {
      album.shareToken = crypto.randomBytes(16).toString('hex');
    }
    album.isPublic = true;
    await album.save();

    res.json({ shareToken: album.shareToken, shareLink: `/shared-album/${album.shareToken}` });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const revokeShareLink = async (req: any, res: Response) => {
  try {
    const album = await Album.findOne({ _id: req.params.id, userId: req.user._id });
    if (!album) return res.status(404).json({ message: 'Album not found' });

    album.isPublic = false;
    album.shareToken = undefined;
    await album.save();

    res.json({ message: 'Share link revoked' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Public endpoint – no auth required, anyone with the token can view
export const getPublicAlbum = async (req: Request, res: Response) => {
  try {
    const album = await Album.findOne({ shareToken: req.params.token, isPublic: true });
    if (!album) return res.status(404).json({ message: 'Album not found or link expired' });

    const photos = await Photo.find({ albumId: album._id, deleted: false }).sort({ uploadDate: -1 });
    res.json({ album: { _id: album._id, name: album.name, description: album.description }, photos });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const shareAlbum = async (req: any, res: Response) => {
  try {
    const { targetUserId, permission } = req.body;
    const album = await Album.findOne({ _id: req.params.id, userId: req.user._id });
    if (!album) return res.status(404).json({ message: 'Album not found' });

    let sharedAlbum = await SharedAlbum.findOne({ albumId: album._id });
    if (!sharedAlbum) {
      sharedAlbum = await SharedAlbum.create({
        albumId: album._id,
        ownerId: req.user._id,
        members: [{ userId: targetUserId, permissions: permission || 'Viewer' }],
      });
    } else {
      // Check if already member
      const isMember = sharedAlbum.members.some((m) => m.userId.toString() === targetUserId);
      if (!isMember) {
        sharedAlbum.members.push({ userId: targetUserId, permissions: permission || 'Viewer' });
        await sharedAlbum.save();
      }
    }

    res.json({ message: 'Album shared successfully', sharedAlbum });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const inviteUser = async (req: any, res: Response) => {
  try {
    const { identifier, permission } = req.body;
    if (!identifier) return res.status(400).json({ message: 'Email or username is required' });

    const targetUser = await User.findOne({ 
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Check if target is the owner
    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot share an album with yourself' });
    }

    const album = await Album.findOne({ _id: req.params.id, userId: req.user._id });
    if (!album) return res.status(404).json({ message: 'Album not found' });

    let sharedAlbum = await SharedAlbum.findOne({ albumId: album._id });
    if (!sharedAlbum) {
      sharedAlbum = await SharedAlbum.create({
        albumId: album._id,
        ownerId: req.user._id,
        members: [{ userId: targetUser._id, permissions: permission || 'Viewer' }],
      });
    } else {
      // Check if already a member
      const isMember = sharedAlbum.members.some((m) => m.userId.toString() === targetUser._id.toString());
      if (isMember) return res.status(400).json({ message: 'User is already invited' });
      
      sharedAlbum.members.push({ userId: targetUser._id as any, permissions: permission || 'Viewer' });
      await sharedAlbum.save();
    }

    // Create Notification
    await Notification.create({
      userId: targetUser._id,
      type: 'invite',
      title: 'Album Invitation',
      message: `${req.user.username || 'Someone'} invited you to join "${album.name}"`,
      actionUrl: `/shared-album/${album.shareToken || sharedAlbum._id}`,
      metadata: { albumId: album._id, sharedAlbumId: sharedAlbum._id }
    });

    res.json({ message: 'Invitation sent successfully', sharedAlbum });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCollaboratorRole = async (req: any, res: Response) => {
  try {
    const { targetUserId, permission } = req.body;
    const album = await Album.findOne({ _id: req.params.id, userId: req.user._id });
    if (!album) return res.status(404).json({ message: 'Album not found' });

    const sharedAlbum = await SharedAlbum.findOne({ albumId: album._id });
    if (!sharedAlbum) return res.status(404).json({ message: 'No collaborators found' });

    if (permission === 'remove') {
      sharedAlbum.members = sharedAlbum.members.filter(m => m.userId.toString() !== targetUserId);
    } else {
      const member = sharedAlbum.members.find(m => m.userId.toString() === targetUserId);
      if (!member) return res.status(404).json({ message: 'Collaborator not found' });
      member.permissions = permission;
    }
    
    await sharedAlbum.save();
    res.json({ message: 'Collaborator updated', sharedAlbum });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
