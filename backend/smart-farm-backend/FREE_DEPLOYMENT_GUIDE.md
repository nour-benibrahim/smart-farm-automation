# 🆓 FREE Smart Farm IoT Stack Deployment Guide

## **🚀 Railway Free Deployment (Recommended)**

### **Why Railway for Testing:**
- ✅ **$5/month free credits** (enough for testing)
- ✅ **Easy GitHub integration**
- ✅ **Free database** (PostgreSQL)
- ✅ **Custom domains**
- ✅ **Auto-scaling**
- ✅ **MQTT support** via external broker

### **Monthly Cost: FREE** (with $5 credits)

---

## **📋 Step-by-Step Railway Deployment:**

### **Step 1: Prepare Your Code**

```bash
# In smart-farm-backend directory
git add .
git commit -m "Railway deployment ready"
git push origin main

# In smart-farm-frontend directory
cd ../smart-farm-frontend
git add .
git commit -m "Railway frontend ready"
git push origin main
```

### **Step 2: Deploy Backend to Railway**

1. **Go to [railway.app](https://railway.app)**
2. **Sign up with GitHub**
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Choose your `smart-farm-backend` repository**
6. **Railway will automatically detect it's a Node.js app**
7. **Add PostgreSQL database:**
   - Click "New" → "Database" → "PostgreSQL"
8. **Add environment variables:**
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = `your-secure-jwt-secret`
   - `MQTT_BROKER_URL` = `mqtt://broker.hivemq.com:1883`

### **Step 3: Deploy Frontend to Railway**

1. **Create new Railway project**
2. **Select your `smart-farm-frontend` repository**
3. **Add environment variables:**
   - `API_URL` = `https://your-backend-url.railway.app`
   - `WS_URL` = `wss://your-backend-url.railway.app`

### **Step 4: Configure Custom Domain (Optional)**

1. **In Railway dashboard, go to Settings**
2. **Add custom domain**
3. **Update DNS records**
4. **SSL certificate is automatically provided**

---

## **🆓 Alternative: Vercel + PlanetScale (100% Free)**

### **Step 1: Deploy Frontend to Vercel**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd smart-farm-frontend
vercel --prod
```

### **Step 2: Deploy Backend to Vercel**

```bash
# Deploy backend
cd smart-farm-backend
vercel --prod
```

### **Step 3: Setup PlanetScale Database**

1. **Go to [planetscale.com](https://planetscale.com)**
2. **Sign up with GitHub**
3. **Create new database**
4. **Get connection string**
5. **Update backend environment variables**

---

## **🆓 Alternative: Render (Free Tier)**

### **Step 1: Deploy Backend to Render**

1. **Go to [render.com](https://render.com)**
2. **Sign up with GitHub**
3. **Create new Web Service**
4. **Connect your `smart-farm-backend` repository**
5. **Add PostgreSQL database**
6. **Configure environment variables**

### **Step 2: Deploy Frontend to Render**

1. **Create new Static Site**
2. **Connect your `smart-farm-frontend` repository**
3. **Build command:** `npm run build:prod`
4. **Publish directory:** `dist/smart-farm-frontend`

---

## **🔧 MQTT Broker Options (Free)**

### **Option 1: HiveMQ (Free)**
- **URL:** `mqtt://broker.hivemq.com:1883`
- **WebSocket:** `ws://broker.hivemq.com:8000`
- **Limits:** 100 connections, 1GB/month

### **Option 2: Eclipse Mosquitto (Free)**
- **URL:** `mqtt://test.mosquitto.org:1883`
- **WebSocket:** `ws://test.mosquitto.org:8080`
- **Limits:** Public broker, no guarantees

### **Option 3: AWS IoT Core (Free Tier)**
- **1 million messages/month**
- **250,000 device minutes/month**
- **Perfect for testing**

---

## **📊 Free Tier Comparison:**

| Platform | Frontend | Backend | Database | MQTT | Custom Domain | Monthly Cost |
|----------|----------|---------|----------|------|---------------|--------------|
| **Railway** | ✅ | ✅ | ✅ | ✅ | ✅ | **FREE** |
| **Vercel + PlanetScale** | ✅ | ✅ | ✅ | ❌ | ✅ | **FREE** |
| **Render** | ✅ | ✅ | ✅ | ❌ | ✅ | **FREE** |
| **Netlify + Supabase** | ✅ | ❌ | ✅ | ❌ | ✅ | **FREE** |

---

## **🎯 My Recommendation: Railway**

**Why Railway is perfect for testing:**

1. **💰 Free:** $5/month credits (enough for testing)
2. **🚀 Easy:** One-click deployment from GitHub
3. **🗄️ Database:** Free PostgreSQL included
4. **📡 MQTT:** Easy to integrate external MQTT broker
5. **🌐 Domain:** Custom domains included
6. **📊 Monitoring:** Built-in metrics and logs
7. **🔄 Auto-deploy:** Updates automatically on git push

---

## **🚀 Quick Railway Deployment:**

### **1. Push Code to GitHub**
```bash
git add .
git commit -m "Railway deployment ready"
git push origin main
```

### **2. Deploy on Railway**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add PostgreSQL database
6. Deploy!

### **3. Test Your App**
- **Frontend:** `https://your-app.railway.app`
- **Backend:** `https://your-backend.railway.app`
- **MQTT:** `mqtt://broker.hivemq.com:1883`

---

## **💡 Pro Tips for Free Deployment:**

1. **Use external MQTT broker** (HiveMQ, Mosquitto)
2. **Optimize images** to reduce bandwidth
3. **Enable compression** in your app
4. **Use CDN** for static assets
5. **Monitor usage** to stay within free limits

---

**Your Smart Farm IoT stack can be deployed for FREE and ready for testing in just 10 minutes!** 🌱🆓

Would you like me to help you set up Railway deployment step by step?
