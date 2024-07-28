import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as Tone from 'tone';

// Basic setup for THREE.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;

// Light
scene.add(new THREE.PointLight(0xffffff, 1, 100).position.set(0, 0, 50));
scene.add(new THREE.AmbientLight(0xffffff, 1));

// Camera position
camera.position.z = 100;

// Tone.js setup
const analyser = new Tone.Analyser('fft', 64);
Tone.Destination.connect(analyser);

// Create 3D objects
const objects = [];
const numCylinders = 64;
const createBoxes = () => {
    const spacing = 3;
    const geometry = new THREE.BoxGeometry(2, 2, 1, 64);
    for (let i = 0; i < numCylinders; i++) {
        const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
        const cylinder = new THREE.Mesh(geometry, material);
        cylinder.position.set((i - numCylinders / 2) * spacing, 0, 0);
        scene.add(cylinder);
        objects.push(cylinder);
    }
};
createBoxes();

// Particle system setup
const particleSystems = [];
const particleCount = 2;
const createParticleSystem = (x, y, z) => {
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);
    const color = new THREE.Color();

    for (let i = 0; i < particleCount; i++) {
        positions.set([x, y, z], i * 3);
        velocities.set([(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10], i * 3);
        color.setHSL(Math.random(), 1, 0.5);
        colors.set([color.r, color.g, color.b], i * 3);
        sizes[i] = 2;
        opacities[i] = 1;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particles.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

    const particleMaterial = new THREE.PointsMaterial({
        size: 2,
        vertexColors: true,
        transparent: true,
        opacity: 1
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);
    particleSystems.push({ system: particleSystem, creationTime: Date.now() });
};

// Handle file input
const audioFileInput = document.getElementById('audioFile');
const songTitle = document.getElementById('songTitle');
const playPauseBtn = document.getElementById('playPauseBtn');
const deleteBtn = document.getElementById('deleteBtn');

let player;
let isPlaying = false;
let songEnded = true;

// Beat detection and particle creation
const beatThreshold = 1.118;
const peakHistory = [];
const peakHistorySize = 15;
let lastBeatTime = 0;
const beatInterval = 0.2;

const detectBeat = (dataArray) => {
    const currentTime = Tone.now();
    const energy = dataArray.reduce((sum, value) => sum + value * value, 0);

    peakHistory.push(energy);
    if (peakHistory.length > peakHistorySize) peakHistory.shift();

    const averagePeak = peakHistory.reduce((sum, value) => sum + value, 0) / peakHistory.length;

    const beatDetected = energy > averagePeak * beatThreshold;
    if (beatDetected && (currentTime - lastBeatTime > beatInterval)) {
        lastBeatTime = currentTime;
        return true;
    }
    return false;
};

// Process audio file
const processAudio = async (arrayBuffer) => {
    const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
    player = new Tone.Player(audioBuffer).toDestination();
};

// Handle file input change
audioFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    const arrayBuffer = await file.arrayBuffer();
    await processAudio(arrayBuffer);

    songTitle.textContent = file.name;
    player.start();
    isPlaying = true;
    songEnded = false;
    playPauseBtn.textContent = 'Stop';

    player.onstop = () => {
        isPlaying = false;
        songEnded = true;
        playPauseBtn.textContent = 'Play';
    };

    player.onended = () => {
        player.stop();
        player.dispose();
        player = null;
        isPlaying = false;
        songEnded = true;
        playPauseBtn.textContent = 'Play';
        songTitle.textContent = 'No song playing';
    };
});

// Play/Pause button functionality
playPauseBtn.addEventListener('click', () => {
    if (player) {
        if (isPlaying) {
            player.stop();
        } else {
            player.start();
        }
        isPlaying = !isPlaying;
        playPauseBtn.textContent = isPlaying ? 'Stop' : 'Play';
    } else {
        audioFileInput.click();
    }
});

// Delete button functionality
deleteBtn.addEventListener('click', () => {
    if (player) {
        player.stop();
        player.dispose();
        player = null;
    }
    isPlaying = false;
    songEnded = true;
    playPauseBtn.textContent = 'Play';
    songTitle.textContent = 'No song playing';
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
const animate = () => {
    requestAnimationFrame(animate);

    if (isPlaying && player && player.state === 'started') {
        const dataArray = analyser.getValue();
        objects.forEach((obj, i) => {
            const scale = (dataArray[i] + 140) / 140;
            obj.scale.y = scale * 28;
            obj.material.color.setHSL(scale, 1, 0.5);
        });

        if (detectBeat(dataArray)) {
            objects.forEach(obj => createParticleSystem(obj.position.x, obj.position.y, obj.position.z));
        }
    } else {
        const time = Date.now() * 0.002;
        objects.forEach((obj, i) => {
            const scale = (Math.sin(i * 0.3 + time) + 1.5) * 7;
            obj.scale.y = scale;
            obj.material.color.setHSL((scale / 15) + 0.5, 1, 0.5);
        });
    }

    particleSystems.forEach((entry, index) => {
        const { system, creationTime } = entry;
        const currentTime = Date.now();

        const { position, velocity, opacity } = system.geometry.attributes;
        const positions = position.array;
        const velocities = velocity.array;
        const opacities = opacity.array;

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] += velocities[i * 3] * 0.1;
            positions[i * 3 + 1] += velocities[i * 3 + 1] * 0.1;
            positions[i * 3 + 2] += velocities[i * 3 + 2] * 0.1;
            opacities[i] = Math.max(opacities[i] - 0.001, 0);
        }

        position.needsUpdate = true;
        opacity.needsUpdate = true;

        if (opacities.every(opacity => opacity === 0)) {
            scene.remove(system);
            particleSystems.splice(index, 1);
        }
    });

    controls.update();
    renderer.render(scene, camera);
};
animate();
