'use strict'

const authService = require('./auth.service')
const { success, error } = require('../../utils/response')

async function register(req, res) {
  try {
    const result = await authService.register(req.body)
    return success(res, result, 'Registrasi berhasil', 201)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body)
    return success(res, result, 'Login berhasil')
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function loginWithGoogle(req, res) {
  try {
    const result = await authService.loginWithGoogle(req.body)
    return success(res, result, 'Login dengan Google berhasil')
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function getProfile(req, res) {
  try {
    const profile = await authService.getProfile(req.user.id)
    return success(res, profile)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function updateProfile(req, res) {
  try {
    const updated = await authService.updateProfile(req.user.id, req.body)
    return success(res, updated, 'Profil berhasil diperbarui')
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function changePassword(req, res) {
  try {
    const result = await authService.changePassword(req.user.id, req.body)
    return success(res, null, result.message)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

module.exports = { register, login, loginWithGoogle, getProfile, updateProfile, changePassword }
