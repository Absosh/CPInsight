// landing_page.js

const observer =
  new IntersectionObserver((entries) => {

    entries.forEach(entry => {

      if (entry.isIntersecting) {

        entry.target.classList.add("fade-up");

      }

    });

  });

document.querySelectorAll("section").forEach(section => {

  observer.observe(section);

});