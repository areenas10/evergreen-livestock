const isUserAuth = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    // For POST requests (Buy Now, Add to Cart), redirect back to the page they came from
    // For GET requests, redirect back to the exact URL they requested
    if (req.method === 'POST' && req.headers.referer) {
        req.session.returnTo = req.headers.referer;
    } else {
        req.session.returnTo = req.originalUrl;
    }
    res.redirect('/auth/login');
};

const isAdminAuth = (req, res, next) => {
    if (req.session.admin) {
        return next();
    }
    res.redirect('/auth/login');
};

module.exports = { isUserAuth, isAdminAuth };
