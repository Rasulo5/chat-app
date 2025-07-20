import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";

/* Процесс регистрации:
1. Получает данные из тела запроса (fullName, email, password, bio)

2. Проверяет, что все обязательные поля заполнены

3. Проверяет, нет ли уже пользователя с таким email

4. Генерирует "соль" и хеширует пароль

5. Создает нового пользователя в базе данных

6. Генерирует JWT-токен с ID пользователя

7. Возвращает данные пользователя и токен */

//Sign up a new user
export const signup = async (req, res) => {
  const { fullName, email, password, bio } = req.body;

  // Проверка на заполнение всех полей
  try {
    if (!fullName || !email || !password || !bio) {
      return res.json({ success: false, message: "Missing Details" });
    }
    // Проверка на существование пользователя
    const user = await User.findOne({ email });
    if (user) {
      return res.json({ success: false, message: "Account already exist" });
    }
    // Хеширование пароля
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Создание нового пользователя
    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword,
      bio,
    });

    // Генерация токена
    const token = generateToken(newUser._id);

    // Отправка ответа
    res.json({
      success: true,
      userData: newUser,
      token,
      message: "Account created succesfully",
    });
  } catch (error) {
    console.log(error.message);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

/* Процесс входа:
1. Получает email и password из тела запроса

2. Находит пользователя по email

3. Сравнивает предоставленный пароль с хешем из базы данных

4. Если пароль неверный, возвращает ошибку

5. Если всё верно, генерирует новый токен

6. Возвращает данные пользователя и токен */

// Controller to login a user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Поиск пользователя по email
    const userData = await User.findOne({ email });
    // Проверка пароля
    const isPasswordCorrect = await bcrypt.compare(password, userData.password);
    if (!isPasswordCorrect) {
      return res.json({ success: false, message: "Invalid credentials" });
    }
    // Генерация токена
    const token = generateToken(userData._id);
    // Отправка ответа
    res.json({ success: true, userData, token, message: "Login successfull" });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Controller to check if user is authenticated

export const checkAuth = (req, res) => {
  res.json({ success: true, user: req.user });
};

// Controller to update user profile details

/* Процесс обновления профиля:
1. Получает новые данные из тела запроса (profilePic, bio, fullName)

2. Получает ID пользователя из аутентифицированного запроса

3. Если нет нового изображения профиля:

     Обновляет только bio и fullName

4. Если есть новое изображение:

     Загружает его в Cloudinary

     Обновляет ссылку на изображение, bio и fullName

5. Возвращает обновленные данные пользователя */

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, bio, fullName } = req.body;
    const userId = req.user._id;
    let updatedUser;
    // Если нет нового изображения профиля
    if (!profilePic) {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { bio, fullName },
        { new: true }
      );
    } else {
      // Если есть новое изображение - загружаем в Cloudinary
      const upload = await cloudinary.uploader.upload(profilePic);
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { profilePic: upload.secure_url, bio, fullName },
        { new: true }
      );
      // Отправка обновленных данных пользователя
      res.json({ success: true, user: updatedUser });
    }
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};
