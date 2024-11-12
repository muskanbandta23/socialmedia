const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(cors());

const USERS_FILE = './data/users.json';
const POSTS_FILE = './data/posts.json';

async function readJSON(file) {
    try {
        const data = await fs.readFile(file, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function writeJSON(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

async function checkDuplicateUser(email, mobile) {
    const users = await readJSON(USERS_FILE);
    return users.some(user => user.email === email || user.mobile === mobile);
}

app.post('/register', async (req, res) => {
    const { username, email, password, mobile } = req.body;

    if (await checkDuplicateUser(email, mobile)) {
        return res.status(400).json({ message: 'Email or mobile already in use.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: uuidv4(), username, email, password: hashedPassword, mobile, role: 'user', followers: [], following: [] };
    
    const users = await readJSON(USERS_FILE);
    users.push(newUser);
    await writeJSON(USERS_FILE, users);
    res.status(201).json({ message: 'User registered successfully.' });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const users = await readJSON(USERS_FILE);
    const user = users.find(user => user.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Simulate setting user session or token (for simplicity, return user role)
    res.status(200).json({ message: 'Login successful', userRole: user.role });
});

app.post('/createPost', async (req, res) => {
    const { userId, title, description } = req.body;
    const post = { id: uuidv4(), userId, title, description, comments: [], likes: [] };

    const posts = await readJSON(POSTS_FILE);
    posts.push(post);
    await writeJSON(POSTS_FILE, posts);
    res.status(201).json({ message: 'Post created', post });
});

app.post('/posts', async (req, res) => {
    const { userId } = req.body;
    const posts = await readJSON(POSTS_FILE);

    // Filter posts based on user access level
    const userPosts = posts.filter(post => post.userId === userId || post.isPublic);
    res.json(userPosts);
});

app.post('/addComment', async (req, res) => {
    const { postId, userId, commentText } = req.body;

    const posts = await readJSON(POSTS_FILE);
    const post = posts.find(p => p.id === postId);
    
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    post.comments.push({ id: uuidv4(), userId, text: commentText, replies: [] });
    await writeJSON(POSTS_FILE, posts);
    
    res.status(201).json({ message: 'Comment added' });
});

app.post('/editPost', async (req, res) => {
    const { postId, userId, title, description } = req.body;

    const posts = await readJSON(POSTS_FILE);
    const post = posts.find(p => p.id === postId && p.userId === userId);

    if (!post) return res.status(403).json({ message: 'Permission denied or post not found' });

    post.title = title;
    post.description = description;
    await writeJSON(POSTS_FILE, posts);
    
    res.status(200).json({ message: 'Post updated', post });
});

app.post('/deletePost', async (req, res) => {
    const { postId, userId, userRole } = req.body;

    let posts = await readJSON(POSTS_FILE);
    const post = posts.find(p => p.id === postId);

    if (!post || (post.userId !== userId && userRole !== 'admin')) {
        return res.status(403).json({ message: 'Permission denied' });
    }

    posts = posts.filter(p => p.id !== postId);
    await writeJSON(POSTS_FILE, posts);

    res.status(200).json({ message: 'Post deleted' });
});

app.post('/likePost', async (req, res) => {
    const { postId, userId } = req.body;

    const posts = await readJSON(POSTS_FILE);
    const post = posts.find(p => p.id === postId);

    if (!post) return res.status(404).json({ message: 'Post not found' });

    if (!post.likes.includes(userId)) {
        post.likes.push(userId);
    } else {
        post.likes = post.likes.filter(id => id !== userId);
    }

    await writeJSON(POSTS_FILE, posts);
    res.status(200).json({ message: 'Post liked/unliked', likesCount: post.likes.length });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
