// Evergreen Livestock - Client Side Interactions

document.addEventListener('DOMContentLoaded', () => {
    console.log('Evergreen Livestock Premium Platform Initialized');

    // Handle delete confirmation for admin
    const deleteButtons = document.querySelectorAll('.btn-danger');
    deleteButtons.forEach(button => {
        if (button.innerText === 'Delete') {
            button.addEventListener('click', (e) => {
                if (!confirm('Are you sure you want to delete this item?')) {
                    e.preventDefault();
                }
            });
        }
    });

    // Intersection Observer for Scroll Reveals
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // Unobserve to prevent re-triggering and flickering
            }
        });
    }, observerOptions);

    document.querySelectorAll('.scroll-reveal, .reveal').forEach(el => {
        el.classList.add('scroll-reveal'); // Normalize old .reveal classes
        observer.observe(el);
    });

    // Trigger reveal for elements instantly in view (removed timeout to prevent flash)
    document.querySelectorAll('.scroll-reveal').forEach(el => {
        const rect = el.getBoundingClientRect();
        if(rect.top < window.innerHeight && rect.bottom >= 0) {
            el.classList.add('is-visible');
        }
    });

    // Interactive effects disabled for stability (requested by user)
    /*
    const tiltCards = document.querySelectorAll('.tilt-card, .farm-card');
    tiltCards.forEach(card => {
        card.addEventListener('mousemove', e => { ... });
        card.addEventListener('mouseleave', () => { ... });
    });
    */

    // Mouse Parallax Effect for Hero
    const heroSection = document.querySelector('.parallax-hero');
    const heroBg = document.getElementById('heroBg');
    const heroContent = document.getElementById('heroContent');

    if(heroSection && heroBg && heroContent) {
        heroSection.addEventListener('mousemove', e => {
            const x = (e.clientX / window.innerWidth - 0.5) * 20;
            const y = (e.clientY / window.innerHeight - 0.5) * 20;

            heroBg.style.transition = 'none';
            heroContent.style.transition = 'none';
            heroBg.style.transform = `translate(${x * -1}px, ${y * -1}px) scale(1.05)`;
            heroContent.style.transform = `translate(${x * 0.5}px, ${y * 0.5}px)`;
        });

        heroSection.addEventListener('mouseleave', () => {
            heroBg.style.transition = 'transform 0.5s ease-out';
            heroContent.style.transition = 'transform 0.5s ease-out';
            heroBg.style.transform = `translate(0, 0) scale(1.05)`; // keep scaled up
            heroContent.style.transform = `translate(0, 0)`;
        });
    }
});
