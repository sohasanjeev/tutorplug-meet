// Test TutorPlug End-to-End Requirements:
// 1. Google/Gmail Authentication
// 2. Permanent Meeting Link per user
// 3. Quota enforcement (blocking unapproved extra links)
// 4. Tutor link request
// 5. Admin authorization & extra link provisioning
// 6. User links retrieval

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('🧪 Starting TutorPlug End-to-End Verification...\n');

  // Test 1: Google / Gmail Authentication
  console.log('1️⃣ Testing Google/Gmail Authentication:');
  const uniqueId = Math.floor(1000 + Math.random() * 9000);
  const googleUserPayload = {
    email: `tutor.${Date.now()}@gmail.com`,
    name: `Tutor Alex ${uniqueId}`,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    googleId: `g-${Date.now()}`
  };

  const authRes = await fetch(`${BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(googleUserPayload)
  });

  if (!authRes.ok) {
    throw new Error(`Google Auth failed: ${authRes.status} ${await authRes.text()}`);
  }

  const authData = await authRes.json();
  const tutorUser = authData.user;
  const tutorToken = authData.token;

  console.log(`   ✅ Logged in via Gmail: ${tutorUser.email}`);
  console.log(`   ✅ Permanent Room Code Assigned: ${tutorUser.personalMeetingCode}`);
  console.log(`   ✅ Default Link Quota: ${tutorUser.allowedLinkQuota}`);

  if (!tutorUser.personalMeetingCode.startsWith('tp-')) {
    throw new Error(`Invalid permanent meeting code format: ${tutorUser.personalMeetingCode}`);
  }

  // Verify permanent meeting exists in DB
  const roomRes = await fetch(`${BASE_URL}/api/meetings/code/${tutorUser.personalMeetingCode}`);
  if (!roomRes.ok) {
    throw new Error(`Permanent room code not resolvable: ${roomRes.status}`);
  }
  const roomData = await roomRes.json();
  console.log(`   ✅ Permanent Room Verified: "${roomData.meeting.title}" (is_permanent: ${roomData.meeting.is_permanent})`);

  // Test 2: Attempting to create an unauthorized second link (Quota check)
  console.log('\n2️⃣ Testing Link Quota Enforcement (Default Quota = 1):');
  const extraLinkRes = await fetch(`${BASE_URL}/api/meetings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tutorToken}`
    },
    body: JSON.stringify({
      title: 'Unauthorized Secondary Room',
      hostId: tutorUser.id
    })
  });

  console.log(`   Response status: ${extraLinkRes.status}`);
  const extraLinkData = await extraLinkRes.json();
  if (extraLinkRes.status === 403) {
    console.log(`   ✅ Correctly blocked unapproved second room: "${extraLinkData.error}"`);
    console.log(`      Current Links: ${extraLinkData.currentLinks}, Quota: ${extraLinkData.allowedQuota}`);
  } else {
    throw new Error(`Expected 403 Forbidden for exceeding quota, got ${extraLinkRes.status}`);
  }

  // Test 3: Tutor submits Link Authorization Request
  console.log('\n3️⃣ Testing Tutor Request for Additional Meeting Link:');
  const requestRes = await fetch(`${BASE_URL}/api/meetings/request-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tutorToken}`
    },
    body: JSON.stringify({
      userId: tutorUser.id,
      userName: tutorUser.name,
      userEmail: tutorUser.email,
      requestedTitle: 'AP Physics Exam Prep',
      reason: 'Need a dedicated recurring room for AP Physics Exam Prep'
    })
  });

  if (!requestRes.ok) {
    throw new Error(`Link request failed: ${requestRes.status} ${await requestRes.text()}`);
  }

  const requestData = await requestRes.json();
  console.log(`   ✅ Link request submitted: Request ID = ${requestData.requestId}`);
  console.log(`   ✅ Message: ${requestData.message}`);

  // Test 4: Admin Panel Authorization Flow
  console.log('\n4️⃣ Testing Admin Authorization via Admin Panel:');
  // Log in as Admin
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@tutorplug.com',
      password: 'Admin@123456'
    })
  });

  if (!adminLoginRes.ok) {
    throw new Error(`Admin login failed: ${adminLoginRes.status}`);
  }

  const adminAuth = await adminLoginRes.json();
  const adminToken = adminAuth.token;
  console.log(`   ✅ Admin logged in (${adminAuth.user.email})`);

  // Fetch pending requests
  const pendingRes = await fetch(`${BASE_URL}/api/admin/link-requests`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const pendingData = await pendingRes.json();
  const pendingRequests = pendingData.requests || [];
  const targetRequest = pendingRequests.find(r => r.id === requestData.requestId);

  if (!targetRequest) {
    throw new Error(`Submitted request ${requestData.requestId} not found in admin queue`);
  }
  console.log(`   ✅ Found pending request from ${targetRequest.user_name} (${targetRequest.user_email})`);

  // Approve the request
  const approveRes = await fetch(`${BASE_URL}/api/admin/link-requests/${targetRequest.id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      reviewerName: 'Super Admin'
    })
  });

  if (!approveRes.ok) {
    throw new Error(`Approval failed: ${approveRes.status} ${await approveRes.text()}`);
  }

  const approveData = await approveRes.json();
  console.log(`   ✅ Request Authorized by Admin!`);
  console.log(`   ✅ New Provisioned Meeting Code: ${approveData.meetingCode}`);

  // Test 5: Verify Tutor's authorized links list
  console.log('\n5️⃣ Testing User Authorized Links Retrieval:');
  const userLinksRes = await fetch(`${BASE_URL}/api/meetings/user/${tutorUser.id}/links`, {
    headers: { 'Authorization': `Bearer ${tutorToken}` }
  });
  const userLinksData = await userLinksRes.json();
  const meetings = userLinksData.meetings;
  console.log(`   Total Active Rooms for User: ${meetings.length}`);
  meetings.forEach((link, idx) => {
    console.log(`     [${idx + 1}] Code: ${link.code} | Title: "${link.title}" | Permanent: ${link.is_permanent === 1}`);
  });

  if (meetings.length !== 2) {
    throw new Error(`Expected 2 rooms (1 permanent + 1 authorized), found ${meetings.length}`);
  }

  // Test 6: Verify Health and Public Home route
  console.log('\n6️⃣ Testing Client Delivery & Index HTML:');
  const indexRes = await fetch(`${BASE_URL}/`);
  const indexHtml = await indexRes.text();
  if (indexHtml.includes('TutorPlug')) {
    console.log('   ✅ Client HTML serves "TutorPlug" title and branding');
  } else {
    throw new Error('Index HTML does not contain TutorPlug branding');
  }

  console.log('\n🎉 ALL TUTORPLUG REQUIREMENTS VERIFIED & WORKING PERFECTLY! 🎉\n');
}

runTests().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
