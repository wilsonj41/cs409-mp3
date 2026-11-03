import { Router } from 'express';
import User from '../models/user';
import { deleteUser, saveUser } from '../services/resources';
import resourceRoutes from './resources';

export default function (router: Router) {
    return resourceRoutes(router, User, saveUser, deleteUser);
}
