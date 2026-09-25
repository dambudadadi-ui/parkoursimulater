/* =========================================================
   WORLD PARKOUR - FIXED GAME JS
========================================================= */

let money = 0;
let stage = 1;
let dungeon = 0;

let health = 100;
let maxHealth = 100;

let bossHealth = 100;
let bossMaxHealth = 100;

let inventory = [];

let gameRunning = false;
let stageWon = false;
let stageStarting = false;

let playerX = 70;
let playerY = 70;

let velocityX = 0;
let velocityY = 0;

let jumping = false;
let onGround = false;

let platforms = [];
let hazards = [];
let coins = [];
let fireballs = [];

let dragonX = 1500;
let dragonY = 250;
let dragonTimer = 100;

let worldWidth = 5000;

let authMode = "login";

let completedStages = [0, 0, 0];

let upgrades = {
  speed: 0,
  health: 0,
  damage: 0,
  healthPotion: 0,
};

const keys = {
  left: false,
  right: false,
};

const dungeonNames = ["EARTH WORLD", "CANDY WORLD", "COOKIE WORLD"];

const dungeonIcons = ["🌍", "🍬", "🍪"];

const difficulty = [1, 1.4, 2];

/* =========================================================
   ELEMENTS
========================================================= */

const $ = (id) => document.getElementById(id);

let player = null;
let world = null;
let gameArea = null;

let platformsContainer = null;
let hazardsContainer = null;
let coinsContainer = null;

let boss = null;
let bossHealthBar = null;

/* =========================================================
   INITIALIZE ELEMENT REFERENCES
========================================================= */

function cacheElements() {
  player = $("player");
  world = $("world");
  gameArea = $("gameArea");

  platformsContainer = $("platforms");
  hazardsContainer = $("hazards");
  coinsContainer = $("coins");

  boss = $("boss");
  bossHealthBar = $("bossHealthBar");
}

/* =========================================================
   SAFE TEXT
========================================================= */

function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent = value;
  }
}

/* =========================================================
   SUPABASE
========================================================= */

function supabaseReady() {
  if (typeof supabaseClient === "undefined") {
    console.error("supabaseClient was not found.");
    return false;
  }

  return true;
}

/* =========================================================
   AUTH
========================================================= */

function showAuth(mode = "login") {
  authMode = mode;

  $("authScreen")?.classList.remove("hidden");
  $("menu")?.classList.add("hidden");
  $("game")?.classList.add("hidden");
  $("shop")?.classList.add("hidden");
  $("locker")?.classList.add("hidden");

  const signup = mode === "signup";

  setText("authTitle", signup ? "CREATE ACCOUNT" : "WELCOME BACK");

  setText(
    "authSubtitle",
    signup
      ? "Create your Dungeon Parkour account."
      : "Login to continue your adventure.",
  );

  $("usernameGroup")?.classList.toggle("hidden", !signup);

  setText("authSubmit", signup ? "CREATE ACCOUNT" : "LOGIN");

  setText(
    "authSwitch",
    signup ? "Already have an account?" : "Create an account",
  );

  authMessage("");
}

function authMessage(message) {
  const element = $("authMessage");

  if (element) {
    element.textContent = message;
  }
}

/* =========================================================
   AUTH SUBMIT
========================================================= */

async function submitAuth() {
  if (!supabaseReady()) {
    authMessage("Supabase is not connected.");
    return;
  }

  const email = $("emailInput")?.value.trim() || "";
  const password = $("passwordInput")?.value || "";

  if (!email || !password) {
    authMessage("Enter your email and password.");
    return;
  }

  const button = $("authSubmit");

  if (button) {
    button.disabled = true;
  }

  authMessage("Connecting...");

  try {
    if (authMode === "signup") {
      await signupUser(email, password);
    } else {
      await loginUser(email, password);
    }
  } catch (error) {
    console.error(error);

    authMessage(error?.message || "Something went wrong.");

    if (button) {
      button.disabled = false;
    }
  }
}

/* =========================================================
   SIGN UP
========================================================= */

async function signupUser(email, password) {
  const username = $("usernameInput")?.value.trim() || "";

  if (username.length < 3) {
    authMessage("Username must be at least 3 characters.");

    $("authSubmit").disabled = false;
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data?.session) {
    await initializeUser();
    return;
  }

  authMessage(
    "Account created! Check your email if confirmation is enabled, then log in.",
  );

  $("authSubmit").disabled = false;
}

/* =========================================================
   LOGIN
========================================================= */

async function loginUser(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (!data?.user) {
    throw new Error("Login succeeded but no user was returned.");
  }

  await initializeUser();
}

/* =========================================================
   INITIALIZE USER
========================================================= */

async function initializeUser() {
  try {
    authMessage("Loading your game...");

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      throw new Error("No logged-in user.");
    }

    let { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      const username =
        user.user_metadata?.username ||
        "PLAYER_" + user.id.replaceAll("-", "").slice(0, 8);

      const { data: newProfile, error } = await supabaseClient
        .from("profiles")
        .insert({
          id: user.id,
          username,
          money: 0,
          stage: 1,
          dungeon: 0,
          inventory: [],
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      profile = newProfile;
    }

    money = Math.max(0, Number(profile.money) || 0);

    inventory = Array.isArray(profile.inventory) ? profile.inventory : [];

    const globalStage = Math.max(1, Number(profile.stage) || 1);

    dungeon = Math.min(2, Math.floor((globalStage - 1) / 10));

    stage = ((globalStage - 1) % 10) + 1;

    completedStages = [0, 0, 0];

    if (dungeon === 0) {
      completedStages[0] = Math.max(0, stage - 1);
    }

    if (dungeon === 1) {
      completedStages[0] = 10;
      completedStages[1] = Math.max(0, stage - 1);
    }

    if (dungeon === 2) {
      completedStages[0] = 10;
      completedStages[1] = 10;
      completedStages[2] = Math.max(0, stage - 1);
    }

    loadUpgrades();

    setText("playerUsername", profile.username || "PLAYER");

    setText("authButton", "LOGOUT");

    $("authScreen")?.classList.add("hidden");
    $("menu")?.classList.remove("hidden");
    $("game")?.classList.add("hidden");
    $("shop")?.classList.add("hidden");
    $("locker")?.classList.add("hidden");

    updateDungeonCards();
    updateUI();

    await loadLeaderboard();

    authMessage("");
  } catch (error) {
    console.error("INITIALIZE USER ERROR:", error);

    authMessage(
      "Login error: " + (error?.message || "Could not load your account."),
    );

    $("authSubmit").disabled = false;
  }
}

/* =========================================================
   UPGRADES
========================================================= */

function loadUpgrades() {
  upgrades = {
    speed: 0,
    health: 0,
    damage: 0,
    healthPotion: 0,
  };

  for (const item of inventory) {
    if (item === "speed") {
      upgrades.speed++;
    }

    if (item === "moreHealth") {
      upgrades.health++;
    }

    if (item === "damage") {
      upgrades.damage++;
    }

    if (item === "healthPotion") {
      upgrades.healthPotion++;
    }
  }
}

/* =========================================================
   SAVE
========================================================= */

async function saveProgress() {
  if (!supabaseReady()) {
    return;
  }

  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return;
    }

    const globalStage = dungeon * 10 + stage;

    const { error } = await supabaseClient
      .from("profiles")
      .update({
        money: Math.floor(money),
        stage: globalStage,
        dungeon,
        inventory,
      })
      .eq("id", user.id);

    if (error) {
      console.error("SAVE ERROR:", error);
    }
  } catch (error) {
    console.error("SAVE PROGRESS ERROR:", error);
  }
}

/* =========================================================
   UI
========================================================= */

function updateUI() {
  setText("money", Math.floor(money));

  setText("stage", dungeon * 10 + stage);

  setText("health", Math.max(0, Math.round(health)));

  setText("gameHealth", Math.max(0, Math.round(health)));

  setText("shopMoney", Math.floor(money));

  updateShopPrices();
}

/* =========================================================
   WORLD CARDS
========================================================= */

function updateDungeonCards() {
  const cards = document.querySelectorAll(".worldCard");

  cards.forEach((card, index) => {
    const unlocked = index === 0 || completedStages[index - 1] >= 10;

    card.style.opacity = unlocked ? "1" : "0.45";

    card.style.filter = unlocked ? "none" : "grayscale(1)";

    const small = card.querySelector("small");

    if (small) {
      small.textContent = unlocked
        ? `Stages ${index * 10 + 1}-${index * 10 + 10}`
        : "🔒 LOCKED";
    }

    const progress =
      index === 0
        ? $("earthProgress")
        : index === 1
          ? $("candyProgress")
          : $("cookieProgress");

    if (progress) {
      if (!unlocked) {
        progress.textContent = "LOCKED";
      } else {
        progress.textContent = `${completedStages[index]} / 10`;
      }
    }
  });
}

/* =========================================================
   SELECT WORLD
   IMPORTANT: HTML calls selectWorld()
========================================================= */

function selectWorld(selected) {
  if (selected < 0 || selected > 2) {
    return;
  }

  if (selected > 0 && completedStages[selected - 1] < 10) {
    showMessage("🔒 Complete the previous world first!");

    return;
  }

  dungeon = selected;

  stage = Math.min(completedStages[dungeon] + 1, 10);

  $("menu")?.classList.add("hidden");
  $("game")?.classList.remove("hidden");

  startStage();
}

/* Backwards compatibility */
function selectDungeon(selected) {
  selectWorld(selected);
}

/* =========================================================
   START STAGE
========================================================= */

function startStage() {
  if (stageStarting) {
    return;
  }

  cacheElements();

  stageStarting = true;
  gameRunning = false;
  stageWon = false;

  velocityX = 0;
  velocityY = 0;

  jumping = false;
  onGround = false;

  generateStage();

  /*
    SAFE SPAWN

    First platform:
    bottom = 45
    height = 25

    Platform top = 70

    Player bottom = 70
  */

  playerX = 70;

  playerY = platforms.length > 0 ? platforms[0].y + platforms[0].height : 70;

  maxHealth = 100 + upgrades.health * 20;

  health = maxHealth;

  bossMaxHealth = 250 * difficulty[dungeon] * (1 + stage * 0.08);

  bossHealth = bossMaxHealth;

  fireballs = [];

  dragonTimer = Math.max(45, 110 - dungeon * 15 - stage * 2);

  setText("gameStage", `${stage} / 10`);

  setText("worldName", dungeonNames[dungeon]);

  setText("dungeonName", dungeonNames[dungeon]);

  /*
    There is no boss HTML element in the
    current HTML, so create one automatically.
  */

  createBoss();

  if (boss) {
    boss.style.display = "block";
  }

  if (bossHealthBar) {
    bossHealthBar.style.width = "100%";
  }

  updatePlayer();
  updateUI();

  showMessage(
    `${dungeonIcons[dungeon]} ${dungeonNames[dungeon]} — STAGE ${stage}`,
  );

  /*
    Wait one frame before enabling movement.
    This prevents the player from starting
    before the stage exists.
  */

  requestAnimationFrame(() => {
    stageStarting = false;
    gameRunning = true;

    /*
      Make absolutely sure the player
      starts ON the first platform.
    */

    onGround = true;
    velocityY = 0;

    updatePlayer();
  });
}

/* =========================================================
   GENERATE STAGE
========================================================= */

function generateStage() {
  cacheElements();

  platforms = [];
  hazards = [];
  coins = [];

  if (platformsContainer) {
    platformsContainer.innerHTML = "";
  }

  if (hazardsContainer) {
    hazardsContainer.innerHTML = "";
  }

  if (coinsContainer) {
    coinsContainer.innerHTML = "";
  }

  /*
    SAFE FIRST PLATFORM
  */

  addPlatform(0, 45, 550, 25);

  let x = 550;

  const count = 10 + dungeon * 4 + Math.floor(stage * 0.7);

  for (let i = 0; i < count; i++) {
    const gap = 45 + Math.random() * 55;

    x += gap;

    const width = Math.max(120, 200 - dungeon * 15 - stage * 3);

    const height = 55 + Math.random() * 110;

    addPlatform(x, height, width, 25);

    addCoin(x + width / 2, height + 55);

    if (i > 1 && dungeon >= 1 && Math.random() < 0.35) {
      addHazard(x + width / 2, height + 25);
    }

    x += width;
  }

  /*
    BOSS ARENA
  */

  const arenaX = x + 80;

  addPlatform(arenaX, 80, 900, 25);

  dragonX = arenaX + 600;
  dragonY = 250;

  createBoss();

  if (boss) {
    boss.style.left = dragonX + "px";

    boss.style.bottom = dragonY + "px";
  }

  if ($("finish")) {
    $("finish").style.left = arenaX + 780 + "px";

    $("finish").style.bottom = "105px";
  }

  worldWidth = arenaX + 1000;

  if (world) {
    world.style.width = worldWidth + "px";
  }
}

/* =========================================================
   CREATE BOSS
========================================================= */

function createBoss() {
  if (!world) {
    return;
  }

  boss = $("boss");

  /*
    Create boss automatically because
    the supplied HTML does not contain one.
  */

  if (!boss) {
    boss = document.createElement("div");

    boss.id = "boss";

    boss.textContent = "🐉";

    boss.style.position = "absolute";
    boss.style.width = "90px";
    boss.style.height = "90px";
    boss.style.fontSize = "75px";
    boss.style.lineHeight = "90px";
    boss.style.textAlign = "center";
    boss.style.zIndex = "15";
    boss.style.userSelect = "none";

    world.appendChild(boss);
  }

  bossHealthBar = $("bossHealthBar");

  if (!bossHealthBar) {
    bossHealthBar = document.createElement("div");

    bossHealthBar.id = "bossHealthBar";

    bossHealthBar.style.position = "absolute";

    bossHealthBar.style.height = "10px";

    bossHealthBar.style.width = "100%";

    bossHealthBar.style.background = "#ff4058";

    bossHealthBar.style.borderRadius = "10px";

    bossHealthBar.style.border = "2px solid #fff";

    bossHealthBar.style.transform = "translateY(-15px)";

    boss.appendChild(bossHealthBar);
  }
}

/* =========================================================
   PLATFORM
========================================================= */

function addPlatform(x, y, width, height) {
  const platform = {
    x,
    y,
    width,
    height,
  };

  platforms.push(platform);

  if (!platformsContainer) {
    return;
  }

  const element = document.createElement("div");

  element.className = "platform";

  element.style.left = x + "px";

  element.style.bottom = y + "px";

  element.style.width = width + "px";

  element.style.height = height + "px";

  if (dungeon === 0) {
    element.classList.add("earthPlatform");
  }

  if (dungeon === 1) {
    element.classList.add("candyPlatform");
  }

  if (dungeon === 2) {
    element.classList.add("cookiePlatform");
  }

  platformsContainer.appendChild(element);
}

/* =========================================================
   HAZARD
========================================================= */

function addHazard(x, y) {
  const hazard = {
    x,
    y,
    width: 50,
    height: 30,
  };

  hazards.push(hazard);

  if (!hazardsContainer) {
    return;
  }

  const element = document.createElement("div");

  element.className = "hazard";

  element.style.left = x + "px";

  element.style.bottom = y + "px";

  hazardsContainer.appendChild(element);
}

/* =========================================================
   COIN
========================================================= */

function addCoin(x, y) {
  const id = coins.length;

  coins.push({
    id,
    x,
    y,
    collected: false,
  });

  if (!coinsContainer) {
    return;
  }

  const element = document.createElement("div");

  element.className = "coin";

  element.dataset.id = id;

  element.textContent = "¢";

  element.style.left = x + "px";

  element.style.bottom = y + "px";

  coinsContainer.appendChild(element);
}

/* =========================================================
   MOVEMENT
========================================================= */

function updateMovement() {
  if (!gameRunning || stageStarting || stageWon) {
    return;
  }

  const speed = 0.45 + upgrades.speed * 0.12;

  if (keys.left) {
    velocityX -= speed;
  }

  if (keys.right) {
    velocityX += speed;
  }

  if (!keys.left && !keys.right) {
    velocityX *= 0.8;
  }

  const maxSpeed = 5 + upgrades.speed * 0.7;

  velocityX = Math.max(-maxSpeed, Math.min(maxSpeed, velocityX));

  playerX += velocityX;

  playerX = Math.max(0, Math.min(worldWidth - 100, playerX));

  /*
    GRAVITY
  */

  velocityY -= 0.8;

  playerY += velocityY;

  onGround = false;

  resolvePlatformCollision();

  if (playerY < -150) {
    playerFall();
    return;
  }

  updatePlayer();

  checkCollisions();
}

/* =========================================================
   PLATFORM COLLISION
========================================================= */

function resolvePlatformCollision() {
  const playerWidth = 35;

  let landingPlatform = null;

  /*
    Falling only
  */

  if (velocityY <= 0) {
    for (const platform of platforms) {
      const playerLeft = playerX;

      const playerRight = playerX + playerWidth;

      const platformLeft = platform.x;

      const platformRight = platform.x + platform.width;

      const previousBottom = playerY - velocityY;

      const playerBottom = playerY;

      const platformTop = platform.y + platform.height;

      const horizontal =
        playerRight > platformLeft && playerLeft < platformRight;

      const crossed =
        previousBottom >= platformTop && playerBottom <= platformTop;

      if (horizontal && crossed) {
        landingPlatform = platform;

        break;
      }
    }
  }

  if (landingPlatform) {
    playerY = landingPlatform.y + landingPlatform.height;

    velocityY = 0;

    jumping = false;
    onGround = true;

    return;
  }

  /*
    Keep player attached if
    standing directly on a platform.
  */

  for (const platform of platforms) {
    const playerCenter = playerX + 17;

    const top = platform.y + platform.height;

    const horizontal =
      playerCenter > platform.x && playerCenter < platform.x + platform.width;

    const closeToTop = Math.abs(playerY - top) < 5;

    if (horizontal && closeToTop && velocityY <= 0) {
      playerY = top;
      velocityY = 0;
      onGround = true;
      jumping = false;

      return;
    }
  }
}

/* =========================================================
   UPDATE PLAYER
========================================================= */

function updatePlayer() {
  if (!player) {
    return;
  }

  player.style.left = playerX + "px";

  player.style.bottom = playerY + "px";

  if (!world || !gameArea) {
    return;
  }

  const screenWidth = gameArea.clientWidth;

  const target = Math.min(
    0,
    Math.max(-(worldWidth - screenWidth), -(playerX - screenWidth * 0.35)),
  );

  world.style.left = target + "px";
}

/* =========================================================
   JUMP
========================================================= */

function jump() {
  if (!gameRunning || stageStarting || stageWon) {
    return;
  }

  if (!onGround) {
    return;
  }

  jumping = true;
  onGround = false;

  velocityY = 15;

  player?.classList.add("playerJump");

  setTimeout(() => {
    player?.classList.remove("playerJump");
  }, 200);
}

/* =========================================================
   COLLISIONS
========================================================= */

function checkCollisions() {
  if (!gameRunning || stageWon) {
    return;
  }

  checkHazards();
  checkCoins();
  checkFinish();
}

/* =========================================================
   HAZARDS
========================================================= */

function checkHazards() {
  for (const hazard of hazards) {
    const hit =
      playerX + 35 > hazard.x &&
      playerX < hazard.x + hazard.width &&
      playerY < hazard.y + 60 &&
      playerY + 50 > hazard.y;

    if (hit) {
      health -= 15 + dungeon * 5;

      playerX -= 35;

      showMessage("💥 TRAP!");

      updateUI();

      if (health <= 0) {
        health = 0;
        playerDied();
        return;
      }
    }
  }
}

/* =========================================================
   COINS
========================================================= */

function checkCoins() {
  for (const coin of coins) {
    if (coin.collected) {
      continue;
    }

    const dx = Math.abs(playerX - coin.x);

    const dy = Math.abs(playerY - coin.y);

    if (dx < 60 && dy < 80) {
      coin.collected = true;

      const element = document.querySelector(`.coin[data-id="${coin.id}"]`);

      element?.remove();

      money += 5 + dungeon * 2;

      updateUI();

      saveProgress();
    }
  }
}

/* =========================================================
   FINISH
========================================================= */

function checkFinish() {
  const finish = $("finish");

  if (!finish) {
    return;
  }

  if (boss && boss.style.display !== "none") {
    return;
  }

  const finishX = parseFloat(finish.style.left) || 0;

  if (playerX > finishX - 100) {
    completeStage();
  }
}

/* =========================================================
   DRAGON
========================================================= */

function updateDragon() {
  if (!gameRunning || stageWon || !boss) {
    return;
  }

  dragonX += (playerX + 250 - dragonX) * 0.01;

  dragonY += (260 + Math.sin(Date.now() / 400) * 70 - dragonY) * 0.03;

  boss.style.left = dragonX + "px";

  boss.style.bottom = dragonY + "px";

  dragonTimer--;

  if (dragonTimer <= 0) {
    dragonShoot();

    dragonTimer = Math.max(45, 110 - dungeon * 15 - stage * 2);
  }
}

/* =========================================================
   DRAGON SHOOT
========================================================= */

function dragonShoot() {
  const dx = playerX - dragonX;

  const dy = playerY - dragonY;

  const distance = Math.sqrt(dx * dx + dy * dy);

  if (!distance) {
    return;
  }

  fireballs.push({
    x: dragonX,
    y: dragonY,
    vx: (dx / distance) * 6,
    vy: (dy / distance) * 6,
    damage: 10 + dungeon * 5 + stage,
  });
}

/* =========================================================
   FIREBALLS
========================================================= */

function updateFireballs() {
  let container = $("dragonProjectiles");

  if (!container) {
    container = document.createElement("div");

    container.id = "dragonProjectiles";

    container.style.position = "absolute";

    container.style.inset = "0";

    container.style.zIndex = "16";

    container.style.pointerEvents = "none";

    world?.appendChild(container);
  }

  container.innerHTML = "";

  for (let i = fireballs.length - 1; i >= 0; i--) {
    const fireball = fireballs[i];

    fireball.x += fireball.vx;

    fireball.y += fireball.vy;

    const hit =
      Math.abs(fireball.x - playerX) < 40 &&
      Math.abs(fireball.y - playerY) < 55;

    if (hit) {
      let damage = fireball.damage;

      if (upgrades.health > 0) {
        damage *= 0.9;
      }

      damage = Math.round(damage);

      health -= damage;

      fireballs.splice(i, 1);

      showMessage(`🔥 -${damage} HP`);

      updateUI();

      if (health <= 0) {
        health = 0;
        playerDied();
        return;
      }

      continue;
    }

    if (fireball.x < -500 || fireball.x > worldWidth + 500) {
      fireballs.splice(i, 1);

      continue;
    }

    const element = document.createElement("div");

    element.className = "dragonFireball";

    element.style.position = "absolute";

    element.style.width = "20px";

    element.style.height = "20px";

    element.style.borderRadius = "50%";

    element.style.background = "#ff4058";

    element.style.boxShadow = "0 0 15px #ff4058";

    element.style.left = fireball.x + "px";

    element.style.bottom = fireball.y + "px";

    container.appendChild(element);
  }
}

/* =========================================================
   ATTACK
========================================================= */

function attack() {
  if (!gameRunning || stageWon) {
    return;
  }

  const distance = Math.abs(playerX - dragonX);

  const damage = 12 + upgrades.damage * 8;

  if (distance < 180) {
    damageDragon(damage);

    showMessage(`⚔ -${damage} DAMAGE`);

    return;
  }

  shootWeapon(damage);
}

/* =========================================================
   SHOOT
========================================================= */

function shootWeapon(damage) {
  if (!world) {
    return;
  }

  const bullet = document.createElement("div");

  bullet.className = "playerBullet";

  bullet.style.position = "absolute";

  bullet.style.width = "14px";

  bullet.style.height = "5px";

  bullet.style.borderRadius = "5px";

  bullet.style.background = "#55e6ff";

  bullet.style.boxShadow = "0 0 12px #55e6ff";

  let x = playerX + 40;

  bullet.style.left = x + "px";

  bullet.style.bottom = playerY + 30 + "px";

  world.appendChild(bullet);

  const timer = setInterval(() => {
    if (!gameRunning) {
      clearInterval(timer);
      bullet.remove();
      return;
    }

    x += 15;

    bullet.style.left = x + "px";

    if (Math.abs(x - dragonX) < 40) {
      clearInterval(timer);

      bullet.remove();

      damageDragon(damage);
    }

    if (x > worldWidth) {
      clearInterval(timer);
      bullet.remove();
    }
  }, 20);
}

/* =========================================================
   DAMAGE DRAGON
========================================================= */

function damageDragon(damage) {
  damage = Math.round(damage + upgrades.damage * 5);

  bossHealth = Math.max(0, bossHealth - damage);

  if (bossHealthBar) {
    bossHealthBar.style.width =
      Math.max(0, (bossHealth / bossMaxHealth) * 100) + "%";
  }

  if (bossHealth <= 0) {
    defeatDragon();
  }
}

/* =========================================================
   DEFEAT DRAGON
========================================================= */

async function defeatDragon() {
  if (stageWon) {
    return;
  }

  stageWon = true;
  gameRunning = false;

  if (boss) {
    boss.style.display = "none";
  }

  const reward = 50 + dungeon * 25 + stage * 10;

  money += reward;

  completedStages[dungeon] = Math.max(completedStages[dungeon], stage);

  showMessage(`🐉 DRAGON DEFEATED! +💰${reward}`);

  updateUI();
  updateDungeonCards();

  await saveProgress();

  setTimeout(() => {
    completeStage();
  }, 1500);
}

/* =========================================================
   COMPLETE STAGE
========================================================= */

function completeStage() {
  if (!stageWon) {
    return;
  }

  if (stage >= 10) {
    completedStages[dungeon] = 10;

    if (dungeon >= 2) {
      showMessage("👑 YOU CONQUERED ALL 30 STAGES!");

      saveProgress();

      setTimeout(backToMenu, 1800);

      return;
    }

    dungeon++;
    stage = 1;

    completedStages[dungeon] = 0;
  } else {
    stage++;
  }

  updateDungeonCards();

  startStage();
}

/* =========================================================
   DEATH
========================================================= */

function playerDied() {
  if (!gameRunning) {
    return;
  }

  gameRunning = false;

  showMessage("💀 YOU DIED! Restarting...");

  setTimeout(() => {
    startStage();
  }, 1200);
}

/* =========================================================
   FALL
========================================================= */

function playerFall() {
  if (!gameRunning) {
    return;
  }

  gameRunning = false;

  showMessage("💀 YOU FELL! Restarting...");

  setTimeout(() => {
    startStage();
  }, 800);
}

/* =========================================================
   SHOP
========================================================= */

function getShopPrice(type) {
  const prices = {
    speed: 100,
    moreHealth: 150,
    damage: 125,
    healthPotion: 75,
  };

  let level = 0;

  if (type === "speed") {
    level = upgrades.speed;
  }

  if (type === "moreHealth") {
    level = upgrades.health;
  }

  if (type === "damage") {
    level = upgrades.damage;
  }

  if (type === "healthPotion") {
    level = upgrades.healthPotion;
  }

  return Math.floor(prices[type] * Math.pow(1.25, level));
}

/* =========================================================
   OLD HTML COMPATIBILITY
========================================================= */

function buyUpgrade(type) {
  if (type === "health") {
    buyItem("moreHealth");
    return;
  }

  buyItem(type);
}

function buyPotion() {
  buyItem("healthPotion");
}

/* =========================================================
   BUY ITEM
========================================================= */

async function buyItem(type) {
  const price = getShopPrice(type);

  if (money < price) {
    showShopMessage(`You need ${price - money} more coins.`);

    return;
  }

  money -= price;

  if (type === "speed") {
    upgrades.speed++;
    inventory.push("speed");
  }

  if (type === "moreHealth") {
    upgrades.health++;
    inventory.push("moreHealth");

    maxHealth = 100 + upgrades.health * 20;

    health = Math.min(maxHealth, health + 20);
  }

  if (type === "damage") {
    upgrades.damage++;
    inventory.push("damage");
  }

  if (type === "healthPotion") {
    upgrades.healthPotion++;

    inventory.push("healthPotion");
  }

  updateUI();

  await saveProgress();

  showShopMessage(
    `✅ ${
      type === "moreHealth" ? "MORE HEALTH" : type.toUpperCase()
    } purchased!`,
  );
}

/* =========================================================
   SHOP MESSAGE
========================================================= */

function showShopMessage(message) {
  showMessage(message);

  console.log("SHOP:", message);
}

/* =========================================================
   POTION
========================================================= */

function useHealthPotion() {
  const index = inventory.indexOf("healthPotion");

  if (index === -1) {
    showMessage("🧪 You don't have a health potion.");

    return;
  }

  inventory.splice(index, 1);

  upgrades.healthPotion = Math.max(0, upgrades.healthPotion - 1);

  const healAmount = 50 + upgrades.health * 5;

  health = Math.min(maxHealth, health + healAmount);

  showMessage(`🧪 +${healAmount} HEALTH`);

  updateUI();

  saveProgress();
}

/* =========================================================
   SHOP NAVIGATION
========================================================= */

function openShop() {
  gameRunning = false;

  $("menu")?.classList.add("hidden");

  $("game")?.classList.add("hidden");

  $("locker")?.classList.add("hidden");

  $("shop")?.classList.remove("hidden");

  updateUI();
}

/* =========================================================
   LOCKER
========================================================= */

function openLocker() {
  gameRunning = false;

  $("menu")?.classList.add("hidden");

  $("game")?.classList.add("hidden");

  $("shop")?.classList.add("hidden");

  $("locker")?.classList.remove("hidden");

  renderLocker();
}

function renderLocker() {
  const grid = $("characterGrid");

  if (!grid) {
    return;
  }

  grid.innerHTML = "";

  const characters = [
    {
      emoji: "🧙",
      name: "MAGE",
      description: "Your default character.",
    },
    {
      emoji: "🧝",
      name: "ELF",
      description: "A fast parkour character.",
    },
    {
      emoji: "🥷",
      name: "NINJA",
      description: "A mysterious warrior.",
    },
    {
      emoji: "🤖",
      name: "ROBOT",
      description: "A futuristic fighter.",
    },
  ];

  characters.forEach((character, index) => {
    const div = document.createElement("div");

    div.className = "character";

    div.innerHTML = `
        <div class="characterEmoji">
          ${character.emoji}
        </div>

        <h3>
          ${character.name}
        </h3>

        <p>
          ${character.description}
        </p>

        <button>
          ${index === 0 ? "SELECT" : "LOCKED"}
        </button>
      `;

    const button = div.querySelector("button");

    if (index > 0) {
      div.classList.add("locked");

      button.disabled = true;
    } else {
      button.onclick = () => {
        if (player) {
          player.textContent = character.emoji;
        }

        showMessage(`✅ ${character.name} selected!`);
      };
    }

    grid.appendChild(div);
  });
}

/* =========================================================
   MENU
========================================================= */

function backToMenu() {
  gameRunning = false;

  $("game")?.classList.add("hidden");

  $("shop")?.classList.add("hidden");

  $("locker")?.classList.add("hidden");

  $("authScreen")?.classList.add("hidden");

  $("menu")?.classList.remove("hidden");

  updateDungeonCards();
  updateUI();
}

/* =========================================================
   MESSAGE
========================================================= */

function showMessage(message) {
  const element = $("stageMessage");

  if (element) {
    element.textContent = message;
  }
}

/* =========================================================
   LOGOUT
========================================================= */

async function logout() {
  try {
    await supabaseClient.auth.signOut();

    location.reload();
  } catch (error) {
    console.error("LOGOUT ERROR:", error);
  }
}

/* =========================================================
   LEADERBOARD
========================================================= */

async function loadLeaderboard() {
  if (!supabaseReady()) {
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("username,stage,money")
      .order("stage", {
        ascending: false,
      })
      .order("money", {
        ascending: false,
      })
      .limit(50);

    if (error) {
      console.error("LEADERBOARD ERROR:", error);

      return;
    }

    const container = $("leaderboardRows");

    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="loading">
          No players yet.
        </div>`;

      return;
    }

    data.forEach((playerData, index) => {
      const row = document.createElement("div");

      row.className = "leaderboardRow";

      row.innerHTML = `
          <span class="rank">
            #${index + 1}
          </span>

          <span class="leaderName">
            ${escapeHTML(playerData.username)}
          </span>

          <span class="leaderStage">
            STAGE ${playerData.stage}
          </span>

          <span class="leaderMoney">
            💰 ${playerData.money}
          </span>
        `;

      container.appendChild(row);
    });
  } catch (error) {
    console.error("LEADERBOARD ERROR:", error);
  }
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {
  const element = document.createElement("div");

  element.textContent = value ?? "";

  return element.innerHTML;
}

/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "a" || key === "arrowleft") {
    keys.left = true;
  }

  if (key === "d" || key === "arrowright") {
    keys.right = true;
  }

  if (key === "w" || key === "arrowup" || event.code === "Space") {
    event.preventDefault();

    jump();
  }

  if (key === "f") {
    attack();
  }

  if (key === "q") {
    useHealthPotion();
  }
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();

  if (key === "a" || key === "arrowleft") {
    keys.left = false;
  }

  if (key === "d" || key === "arrowright") {
    keys.right = false;
  }
});

/* =========================================================
   AUTH BUTTONS
========================================================= */

$("authSubmit")?.addEventListener("click", submitAuth);

$("authSwitch")?.addEventListener("click", () => {
  showAuth(authMode === "login" ? "signup" : "login");
});

$("authButton")?.addEventListener("click", async () => {
  try {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) {
      console.error(error);
      return;
    }

    if (data?.user) {
      await logout();
    } else {
      showAuth("login");
    }
  } catch (error) {
    console.error("AUTH BUTTON ERROR:", error);
  }
});

/* =========================================================
   SHOP BUTTONS
========================================================= */

function updateShopPrices() {
  const speedPrice = $("speedPrice");

  const healthPrice = $("healthPrice");

  const damagePrice = $("damagePrice");

  const potionPrice = $("potionPrice");

  if (speedPrice) {
    speedPrice.textContent = getShopPrice("speed");
  }

  if (healthPrice) {
    healthPrice.textContent = getShopPrice("moreHealth");
  }

  if (damagePrice) {
    damagePrice.textContent = getShopPrice("damage");
  }

  if (potionPrice) {
    potionPrice.textContent = getShopPrice("healthPotion");
  }
}

/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop() {
  updateMovement();
  updateDragon();
  updateFireballs();

  requestAnimationFrame(gameLoop);
}

/* =========================================================
   BOOT
========================================================= */

async function boot() {
  cacheElements();

  if (!supabaseReady()) {
    console.error("Supabase is not ready.");

    showAuth("login");

    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (data?.session) {
      await initializeUser();
    } else {
      showAuth("login");
      await loadLeaderboard();
    }
  } catch (error) {
    console.error("BOOT ERROR:", error);

    showAuth("login");

    authMessage(
      "Could not connect to Supabase: " + (error?.message || "Unknown error"),
    );
  }
}

/* =========================================================
   START
========================================================= */

cacheElements();
boot();
gameLoop();
