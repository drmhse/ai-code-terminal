// Main Site JavaScript
document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

    // --- Starfield Background ---
    const canvas = document.getElementById('starfield-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width, height; let stars = []; const numStars = 1000; const speed = 0.05;
        function initStarfield() {
            width = window.innerWidth; height = window.innerHeight; canvas.width = width; canvas.height = height;
            stars = []; for (let i = 0; i < numStars; i++) { stars.push({ x: (Math.random() - 0.5) * width, y: (Math.random() - 0.5) * height, z: Math.random() * width }); }
        }
        function animateStarfield() {
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--color-bg'); ctx.fillRect(0, 0, width, height);
            ctx.save(); ctx.translate(width / 2, height / 2);
            for (let star of stars) {
                star.z -= speed; if (star.z <= 0) { star.z = width; }
                const sx = star.x * (width / star.z); const sy = star.y * (width / star.z); const r = Math.max(0.1, (width / star.z) * 1.5);
                const opacity = (1 - star.z / width) * 0.8;
                ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fillStyle = `rgba(212, 223, 243, ${opacity})`; ctx.fill();
            }
            ctx.restore(); requestAnimationFrame(animateStarfield);
        }
        window.addEventListener('resize', initStarfield); initStarfield(); animateStarfield();
    }

    // --- Animated Terminal with Claude ---
    const terminalBody = document.getElementById('animated-terminal');
    if (terminalBody) {
        const lines = [
            { text: 'git clone https://github.com/drmhse/remove-comments.git', prompt: true, delay: 1500 },
            { text: `Cloning into 'remove-comments'...
remote: Enumerating objects: 83, done.
remote: Counting objects: 100% (83/83), done.
Receiving objects: 100% (83/83), 21.32 KiB | 7.11 MiB/s, done.
Resolving deltas: 100% (28/28), done.`, prompt: false, delay: 1000 },
            { text: 'cd remove-comments', prompt: true, delay: 1500 },
            { text: 'claude', prompt: true, delay: 2000 },
            { text: `<span style="color:var(--color-accent)">●</span> I'll examine this project to understand what it's about.

<span style="color:var(--color-grey)">● Read(README.md)</span>
<span style="color:var(--color-grey)">● List(/app/workspaces/remove-comments)</span>
<span style="color:var(--color-grey)">● Search(pattern: "package.json")</span>
<span style="color:var(--color-grey)">● Read(index.js)</span>

This is @drmhse/remove-comments - a CLI tool that safely removes comments from source code files while preserving code functionality.

Key Features:
- Zero-dependency NPM package for multiple languages
- Supports JavaScript, TypeScript, Python, and more
- Uses language-specific parsers to avoid breaking code
- Includes a dry-run mode to preview changes

<span style="color:var(--color-green)">The tool appears to be a legitimate defensive utility for code cleanup.</span>`, prompt: false, type: 'claude', delay: 3000 }
        ];

        function typeWriter(element, text, callback) {
            let i = 0;
            function type() {
                if (i < text.length) {
                    element.innerHTML += text.charAt(i); i++;
                    terminalBody.scrollTop = terminalBody.scrollHeight;
                    setTimeout(type, 10);
                } else if (callback) { callback(); }
            }
            type();
        }

        let currentLineIndex = 0;
        function runAnimation() {
            if (currentLineIndex >= lines.length) {
                setTimeout(() => { terminalBody.innerHTML = ''; currentLineIndex = 0; runAnimation(); }, 8000);
                return;
            }

            const line = lines[currentLineIndex];
            const lineElement = document.createElement('div');
            lineElement.className = 'terminal-line';

            if (line.prompt) {
                const promptSpan = `<span class="prompt">sovereign@cct:<span class="path">~/workspaces</span>$ </span>`;
                lineElement.innerHTML = promptSpan;
                terminalBody.appendChild(lineElement);
                const commandSpan = document.createElement('span');
                commandSpan.className = 'command';
                lineElement.appendChild(commandSpan);
                typeWriter(commandSpan, line.text, () => {
                    if (line.text.includes('remove-comments')) {
                        lineElement.innerHTML = `<span class="prompt">sovereign@cct:<span class="path">~/workspaces/remove-comments</span>$ </span>`;
                    } else {
                       lineElement.innerHTML = promptSpan;
                    }
                    commandSpan.innerHTML = line.text;
                    lineElement.appendChild(commandSpan);
                    currentLineIndex++;
                    setTimeout(runAnimation, line.delay);
                });
            } else {
                lineElement.innerHTML = line.text;
                terminalBody.appendChild(lineElement);
                if (line.type === 'claude') {
                    const finalPrompt = document.createElement('div');
                    finalPrompt.className = 'terminal-line';
                    finalPrompt.innerHTML = `<span class="prompt">> </span><span class="cursor"></span>`;
                    terminalBody.appendChild(finalPrompt);
                }
                terminalBody.scrollTop = terminalBody.scrollHeight;
                currentLineIndex++;
                setTimeout(runAnimation, line.delay);
            }
        }

        setTimeout(runAnimation, 1000);
    }

    // Fade in animation
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in-section').forEach(section => { observer.observe(section); });

    // Copy code functionality
    window.copyCode = function(button) {
        const pre = button.nextElementSibling; const code = pre.querySelector('code').innerText;
        navigator.clipboard.writeText(code).then(() => {
            const originalIcon = button.innerHTML; button.innerHTML = '<i data-feather="check"></i>'; feather.replace({width: '16', height: '16'});
            setTimeout(() => { button.innerHTML = originalIcon; feather.replace({width: '16', height: '16'}); }, 2000);
        });
    }
});