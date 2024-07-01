import {ObjectId} from 'mongodb';

export const generateRandomObjectId = () => {
    const objectId = new ObjectId();
    return objectId.toHexString();
};