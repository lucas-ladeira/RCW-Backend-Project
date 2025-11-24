from flask import Flask
from config.database import configure_db, db
from config.jwt import configure_jwt
from config.cors import configure_cors
from src.routes.user_routes import user_bp
from src.routes.auth_routes import auth_bp
from src.routes.blockchain_routes import blockchain_blueprint
from flask_migrate import Migrate

def create_app():
    app = Flask(__name__)
    
    configure_db(app)
    configure_jwt(app)

    migrate = Migrate(app, db)    

    configure_cors(app)

    # Register blueprints
    app.register_blueprint(user_bp, url_prefix='/users')
    app.register_blueprint(auth_bp, url_prefix='/auth')

    return app

app = create_app()